declare const pako: {
  inflate: (data: Uint8Array | number[] | ArrayBuffer) => Uint8Array;
  inflateRaw: (data: Uint8Array | number[] | ArrayBuffer) => Uint8Array;
};
export default pako;
