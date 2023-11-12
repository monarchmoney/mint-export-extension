import { formatCSV } from '../csv';

describe('formatCSV', () => {
  it('formats rows', () => {
    const result = formatCSV([
      ['Date', 'Amount'],
      ['2020-01-01', 123.45],
      ['2020-02-01', 234.56],
    ]);
    expect(result).toEqual(`"Date","Amount"
"2020-01-01","123.45"
"2020-02-01","234.56"
`);
  });
});
