// behavior is tested in the unit tests
export function addN (n: number): (amountToAdd: number) => number {
  return (amountToAdd) => {
    return n + amountToAdd;
  };
}
