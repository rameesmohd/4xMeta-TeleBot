const canonicalPayload = (data = {}) => {
  return Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      const value = data[key];

      if (value === undefined) return acc;

      acc[key] =
        value === null ? "null" : String(value);

      return acc;
    }, {});
};

export default canonicalPayload;
