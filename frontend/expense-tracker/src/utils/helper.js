import moment from "moment";

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const getInitials = (fullName) => {
  if (!fullName) return "";
  const names = fullName.split(" ");
  let initials = "";

  for (let i=0; i<Math.min(names.length, 2); i++) {
    initials += names[i][0];
  }
  return initials.toUpperCase();
}

export const addSeperator = (num) => {
  const [integerPart, fractionPart] = num.toString().split(".");

  const lastThree = integerPart.slice(-3);
  const otherDigits = integerPart.slice(0, -3);

  const formattedInteger = otherDigits
    ? otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;

  return fractionPart ? `${formattedInteger}.${fractionPart}` : formattedInteger;
};

export const prepareExpenseBarChartData = (data = []) => {
  const charData = data.map((item) => ({
    month: moment(item?.date).format('Do MMM'),
    category: item?.category,
    amount: item?.amount
  }));

  return charData;
}

export const prepareIncomeBarChartData = (data = []) => {
  const sortedData = [...data].sort((a,b) => new Date(a.date) - new Date(b.date));

  const chartData = sortedData.map((item) => ({
    month: moment(item?.date).format('Do MMM'),
    amount: item?.amount,
    category: item?.source,
  }));

  return chartData;
}