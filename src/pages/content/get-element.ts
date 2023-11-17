/** Waits for selector to match and returns corresponding element. */
export const getElement = async (selector: string, parent: ParentNode = document) => {
  return new Promise<Element>((resolve) => {
    const find = () => {
      const element = parent.querySelector(selector);
      if (element) {
        resolve(element);
      } else {
        setTimeout(find, 500);
      }
    };
    find();
  });
};
