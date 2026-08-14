"""Zero-shot keyword-scoring categorizer for expense descriptions.

Pure stdlib. Optionally uses scikit-learn's TfidfVectorizer (guarded import)
so prediction works via cosine similarity when no ONNX/embedding model is
present; falls back to keyword scoring when sklearn is missing.
"""
import math
import re

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised when sklearn is missing
    TfidfVectorizer = None
    cosine_similarity = None
    SKLEARN_AVAILABLE = False

STANDARD_CATEGORIES = [
    "Food", "Housing", "Utilities", "Entertainment", "Healthcare",
    "Transport", "Investment", "Salary",
]

# English + light Hindi/Hinglish keywords per category.
CATEGORY_KEYWORDS = {
    "Food": [
        "food", "restaurant", "swiggy", "zomato", "grocer", "veg", "dinner",
        "lunch", "cafe", "kfc", "mcdonald", "pizza", "biriyani", "biryani",
        "chai", "snacks", "kiran", "khana", "tiffin", "breakfast", "eatery",
        "juice", "bake", "bread", "meat", "milk", "grocery", "kirana",
        "chaat", "paratha", "idli", "dosa", "samosa", "burger", "curry",
        "sweets", "meetha", "namkeen",
    ],
    "Housing": [
        "rent", "housing", "flat", "apartment", "maintenance", "deposit",
        "society", "house", "room", "pg", "brokerage", "plot", "home",
        "kaamwali", "househelp", "dhobi", "makan", "kothi", "griha",
    ],
    "Utilities": [
        "electric", "power", "wifi", "internet", "mobile", "recharge",
        "phone", "gas", "water", "dth", "broadband", "bill", "bills",
        "subscription", "subscr", "light", "cookinggas", "lpg", "cylinder",
        "jio", "airtel", "bsnl", "bijli", "pani",
    ],
    "Entertainment": [
        "movie", "netflix", "prime", "spotify", "hotstar", "cinema", "game",
        "playstation", "xbox", "concert", "party", "outing", "pub", "bar",
        "fun", "reel", "song", "music", "streaming", "arcade", "bowling",
        "ticket", "show",
    ],
    "Healthcare": [
        "doctor", "medic", "medicine", "medical", "pharmacy", "hospital",
        "clinic", "checkup", "dental", "ointment", "syrup", "test", "lab",
        "health", "physio", "gym", "supplement", "dawa", "vitamin", "tablet",
        "capsule", "dant",
    ],
    "Transport": [
        "uber", "ola", "fuel", "petrol", "diesel", "train", "bus", "metro",
        "cab", "rapido", "auto", "parking", "toll", "taxi", "flight",
        "rickshaw", "commute", "fare", "petrolpump", "cng", "transport",
        "carwash", "service", "yatra", "sawari", "ride",
    ],
    "Investment": [
        "invest", "stocks", "mutual", "fund", "nifty", "sensex", "fd",
        "fixeddeposit", "deposit", "bond", "sip", "share", "index", "gold",
        "crypto", "bitcoin", "trading", "equity", "portfolio", "dividend",
        "ppf", "nps", "market",
    ],
    "Salary": [
        "salary", "income", "pay", "paycheck", "takehome", "ctc", "monthly",
        "wage", "earnings", "raise", "bonus", "reimbursement", "increment",
        "allowance", "payout", "salarycredit", "vetan", "kamai", "stipend",
        "advance", "due",
    ],
}

# Tiny labelled corpus (description -> category) used to train a TF-IDF
# vectorizer when sklearn is available and no ONNX/embedding model exists.
CORPUS = [
    ("swiggy order biryani", "Food"),
    ("zomato pizza delivery", "Food"),
    ("kfc dinner bucket", "Food"),
    ("kiran shop groceries", "Food"),
    ("cafe chai and snacks", "Food"),
    ("mcdonald breakfast meal", "Food"),
    ("house rent payment", "Housing"),
    ("flat maintenance society", "Housing"),
    ("room deposit landlord", "Housing"),
    ("househelp kaamwali salary", "Housing"),
    ("electricity bill", "Utilities"),
    ("wifi internet recharge", "Utilities"),
    ("mobile phone recharge", "Utilities"),
    ("lpg gas cylinder", "Utilities"),
    ("dth subscription bill", "Utilities"),
    ("netflix subscription", "Entertainment"),
    ("movie tickets cinema", "Entertainment"),
    ("spotify gaming account", "Entertainment"),
    ("pub party drinks", "Entertainment"),
    ("concert show fun", "Entertainment"),
    ("doctor consultation", "Healthcare"),
    ("pharmacy medicine", "Healthcare"),
    ("hospital checkup lab", "Healthcare"),
    ("dental insurance", "Healthcare"),
    ("gym supplement health", "Healthcare"),
    ("uber cab ride", "Transport"),
    ("ola auto fare", "Transport"),
    ("petrol fuel fill", "Transport"),
    ("metro train ticket", "Transport"),
    ("bus parking toll", "Transport"),
    ("stocks mutual fund", "Investment"),
    ("sip fixed deposit fd", "Investment"),
    ("crypto bitcoin gold", "Investment"),
    ("nifty sensex trading", "Investment"),
    ("salary credit salary", "Salary"),
    ("monthly income from client", "Salary"),
    ("freelancer payout", "Salary"),
    ("bonus allowance", "Salary"),
    ("takehome ctc wage", "Salary"),
    ("reimbursement earnings", "Salary"),
]

_CONFIDENCE_THRESHOLD = 0.65
_TFIDF = None
_CORPUS_VECTORS = None
def _normalise(text):
    """Lowercase and strip to letters so tokens match keyword lists."""
    text = (text or "").lower()
    return " ".join(re.findall(r"[a-z]+", text))


def _keyword_scores(description):
    """Return dict of category -> raw keyword score, weighted by token length."""
    text = _normalise(description)
    tokens = set(text.split())
    scores = {category: 0.0 for category in STANDARD_CATEGORIES}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0.0
        for keyword in keywords:
            kw = keyword.lower().strip()
            if not kw:
                continue
            if kw in tokens:
                score += len(kw)
            elif kw in text:
                score += len(kw) * 0.5
        scores[category] = score
    return scores


def _amount_bias(amount, scores):
    """Bias ambiguous larger amounts slightly toward Housing/Investment."""
    if amount <= 0:
        return
    if amount >= 2500:
        for category in ("Housing", "Investment", "Utilities"):
            scores[category] += 1.0
    elif amount >= 800:
        for category in ("Housing", "Investment"):
            scores[category] += 0.5


def _corpus_prediction(description):
    """Predict via TF-IDF cosine similarity against the tiny corpus.

    Returns (category, similarity) or None when sklearn is unavailable or
    the description has no overlap with the corpus vocabulary.
    """
    global _TFIDF, _CORPUS_VECTORS
    if not SKLEARN_AVAILABLE:
        return None
    try:
        if _TFIDF is None:
            _TFIDF = TfidfVectorizer(stop_words="english", lowercase=True)
            _CORPUS_VECTORS = _TFIDF.fit_transform([doc for doc, _ in CORPUS])
        vec = _TFIDF.transform([description])
        sims = cosine_similarity(vec, _CORPUS_VECTORS)[0]
        if sims.size == 0 or float(sims.max()) == 0.0:
            return None
        best_index = int(sims.argmax())
        return CORPUS[best_index][1], float(sims[best_index])
    except Exception:
        return None


def predict_category(description, amount=0.0):
    """Classify a description into one of the standard categories.

    Returns {"category", "confidence", "suggested"} where confidence is in
    0.0-1.0. When the best match confidence is below 0.65 the category is
    "Uncategorized / Review Required" and "suggested" is False.
    """
    description = description or ""
    scores = _keyword_scores(description)
    _amount_bias(amount, scores)

    best_category, best_score = max(
        scores.items(), key=lambda item: item[1]
    )
    confidence = best_score / (best_score + 4) if best_score > 0 else 0.0

    corpus_hit = _corpus_prediction(description) if SKLEARN_AVAILABLE else None
    if corpus_hit is not None:
        corpus_category, corpus_conf = corpus_hit
        if corpus_conf >= 0.80 and corpus_conf * 5.0 > best_score:
            # Corpus signal is strong: prefer it but keep confidence bounded.
            best_category = corpus_category
            confidence = max(confidence, 0.5 + 0.5 * corpus_conf)

    # Confidence is 0.0-1.0.
    confidence = max(0.0, min(1.0, confidence))

    if confidence >= _CONFIDENCE_THRESHOLD and best_category in STANDARD_CATEGORIES:
        return {
            "category": best_category,
            "confidence": round(confidence, 4),
            "suggested": True,
        }

    return {
        "category": "Uncategorized / Review Required",
        "confidence": round(confidence, 4),
        "suggested": False,
    }