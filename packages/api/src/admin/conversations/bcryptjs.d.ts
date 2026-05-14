declare module 'bcryptjs' {
  export function compare(password: string, hash: string): Promise<boolean>;
  export function hash(password: string, saltOrRounds: number): Promise<string>;

  const bcrypt: {
    compare: typeof compare;
    hash: typeof hash;
  };

  export default bcrypt;
}
