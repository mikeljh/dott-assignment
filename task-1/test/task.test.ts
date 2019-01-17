import { expect } from 'chai';
import { addN } from '../task';

describe('task.ts', () => {
  describe('addN', () => {
    it('should return a function', (done) => {
      let addFive = addN(5);
      expect(typeof addFive).to.equal('function');
      done();
    });

    it('returned function should correctly add originally passed parameter', (done) => {
      let n = 15;
      let amountToAdd = 123;

      let addFifteen = addN(n);
      let result = addFifteen(amountToAdd);
      expect(result).to.equal(n + amountToAdd);
      done();
    });

    it('addN called with 8 should return a function that adds 8 to the number you pass', (done) => {
      let addEight = addN(8);
      expect(addEight(7)).to.equal(15);
      expect(addEight(100)).to.equal(108);
      done();
    });
  });
});
