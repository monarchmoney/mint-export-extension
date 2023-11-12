export const formatCSV = (rows: (string | number)[][]) =>
  rows
    .map((row) =>
      row
        .map((val) => `${val ?? ''}`) // make string, replace null/undefined with empty string
        .map((val) => val.replace('"', '')) // ensure there are no double quotes in value
        .map((val) => `"${val}"`) // wrap each value in double quotes
        .join(','),
    )
    .join('\n')
    .concat('\n'); // at newline at end of string
