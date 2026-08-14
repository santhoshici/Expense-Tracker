export type RedisEvalResult = number[] | string[] | number | string;

export interface SetOptions {
  PX?: number;
  EX?: number;
}

export interface RedisLike {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<RedisEvalResult>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, options?: SetOptions): Promise<any>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  close(): Promise<void>;
}

export declare function getRedis(): RedisLike;
export declare function isRedisAvailable(): boolean;
export declare const TOKEN_BUCKET_LUA: string;
