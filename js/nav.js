/* Tiny navigation helper so views never touch location directly. */
export const nav = (hash) => {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
};
