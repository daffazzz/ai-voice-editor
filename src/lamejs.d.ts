declare module 'lamejs/lame.all.js?url' {
  const url: string;
  export default url;
}

declare class LameJsMp3Encoder {
  constructor(channels: number, sampleRate: number, kbps: number);
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}

interface LameJsGlobal {
  Mp3Encoder: typeof LameJsMp3Encoder;
}

interface Window {
  lamejs: LameJsGlobal;
}
