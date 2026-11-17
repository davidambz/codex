// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// A small decoder for the "LZMA alone" (.lzma) format, enough for the
// Warframe Public Export's index (a few hundred bytes). Follows Igor
// Pavlov's public-domain reference decoder, LzmaSpec.cpp, without its
// speed tricks: it decodes everything in memory, one bit at a time.

const PROB_INIT = 1024;
const TOP = 1 << 24;
const NUM_STATES = 12;
const POS_BITS_MAX = 4;
const LEN_LOW_BITS = 3;
const LEN_MID_BITS = 3;
const LEN_HIGH_BITS = 8;
const END_POS_MODEL_INDEX = 14;
const NUM_FULL_DISTANCES = 1 << (END_POS_MODEL_INDEX >> 1);
const NUM_ALIGN_BITS = 4;
const NUM_LEN_TO_POS_STATES = 4;
const MATCH_MIN_LEN = 2;

const probs = (n: number) => new Uint16Array(n).fill(PROB_INIT);

class RangeDecoder {
  private range = 0xffffffff;
  private code = 0;
  private readonly input: Uint8Array;
  private pos: number;

  constructor(input: Uint8Array, pos: number) {
    this.input = input;
    this.pos = pos;
    if (this.byte() !== 0) throw new Error("LZMA: bad range coder start");
    for (let i = 0; i < 4; i++) this.code = ((this.code << 8) | this.byte()) >>> 0;
  }

  private byte(): number {
    if (this.pos >= this.input.length) throw new Error("LZMA: unexpected end of input");
    return this.input[this.pos++];
  }

  private normalize() {
    if (this.range < TOP) {
      this.range = (this.range << 8) >>> 0;
      this.code = ((this.code << 8) | this.byte()) >>> 0;
    }
  }

  get finishedOk() {
    return this.code === 0;
  }

  direct(numBits: number): number {
    let res = 0;
    while (numBits-- > 0) {
      this.range >>>= 1;
      let bit = 1;
      if (this.code >= this.range) {
        this.code = (this.code - this.range) >>> 0;
      } else {
        bit = 0;
      }
      res = ((res << 1) | bit) >>> 0;
      this.normalize();
    }
    return res;
  }

  bit(p: Uint16Array, i: number): number {
    const v = p[i];
    const bound = (this.range >>> 11) * v;
    let symbol: number;
    if (this.code < bound) {
      p[i] = v + ((2048 - v) >>> 5);
      this.range = bound >>> 0;
      symbol = 0;
    } else {
      p[i] = v - (v >>> 5);
      this.code = (this.code - bound) >>> 0;
      this.range = (this.range - bound) >>> 0;
      symbol = 1;
    }
    this.normalize();
    return symbol;
  }

  tree(p: Uint16Array, offset: number, numBits: number): number {
    let m = 1;
    for (let i = 0; i < numBits; i++) m = (m << 1) + this.bit(p, offset + m);
    return m - (1 << numBits);
  }

  reverseTree(p: Uint16Array, offset: number, numBits: number): number {
    let m = 1;
    let symbol = 0;
    for (let i = 0; i < numBits; i++) {
      const b = this.bit(p, offset + m);
      m = (m << 1) + b;
      symbol |= b << i;
    }
    return symbol;
  }
}

class LenDecoder {
  private readonly choice = probs(2);
  private readonly low = probs((1 << POS_BITS_MAX) << LEN_LOW_BITS);
  private readonly mid = probs((1 << POS_BITS_MAX) << LEN_MID_BITS);
  private readonly high = probs(1 << LEN_HIGH_BITS);

  decode(rc: RangeDecoder, posState: number): number {
    if (rc.bit(this.choice, 0) === 0) return rc.tree(this.low, posState << LEN_LOW_BITS, LEN_LOW_BITS);
    if (rc.bit(this.choice, 1) === 0) return 8 + rc.tree(this.mid, posState << LEN_MID_BITS, LEN_MID_BITS);
    return 16 + rc.tree(this.high, 0, LEN_HIGH_BITS);
  }
}

/** Decodes a .lzma ("LZMA alone") file. */
export function decodeLzma(input: Uint8Array): Uint8Array {
  if (input.length < 13) throw new Error("LZMA: header too short");
  let d = input[0];
  if (d >= 9 * 5 * 5) throw new Error("LZMA: bad properties");
  const lc = d % 9;
  d = Math.floor(d / 9);
  const lp = d % 5;
  const pb = Math.floor(d / 5);
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const dictSize = Math.max(view.getUint32(1, true), 1 << 12);
  // An unknown size (all ones) means the stream ends with an end marker.
  const sizeLow = view.getUint32(5, true);
  const sizeHigh = view.getUint32(9, true);
  const sizeKnown = !(sizeLow === 0xffffffff && sizeHigh === 0xffffffff);
  if (sizeKnown && sizeHigh !== 0) throw new Error("LZMA: output too big");
  const unpackSize = sizeLow;

  const out: number[] = [];
  const rc = new RangeDecoder(input, 13);
  const literalProbs = probs(0x300 << (lc + lp));
  const posSlot = probs(NUM_LEN_TO_POS_STATES << 6);
  const posDecoders = probs(1 + NUM_FULL_DISTANCES - END_POS_MODEL_INDEX);
  const align = probs(1 << NUM_ALIGN_BITS);
  const isMatch = probs(NUM_STATES << POS_BITS_MAX);
  const isRep = probs(NUM_STATES);
  const isRepG0 = probs(NUM_STATES);
  const isRepG1 = probs(NUM_STATES);
  const isRepG2 = probs(NUM_STATES);
  const isRep0Long = probs(NUM_STATES << POS_BITS_MAX);
  const lenDecoder = new LenDecoder();
  const repLenDecoder = new LenDecoder();

  const getByte = (dist: number) => out[out.length - dist];

  const decodeLiteral = (state: number, rep0: number) => {
    const prevByte = out.length > 0 ? out[out.length - 1] : 0;
    const litState = ((out.length & ((1 << lp) - 1)) << lc) + (prevByte >>> (8 - lc));
    const base = 0x300 * litState;
    let symbol = 1;
    if (state >= 7) {
      let matchByte = getByte(rep0 + 1);
      do {
        const matchBit = (matchByte >>> 7) & 1;
        matchByte <<= 1;
        const b = rc.bit(literalProbs, base + ((1 + matchBit) << 8) + symbol);
        symbol = (symbol << 1) | b;
        if (matchBit !== b) break;
      } while (symbol < 0x100);
    }
    while (symbol < 0x100) symbol = (symbol << 1) | rc.bit(literalProbs, base + symbol);
    out.push(symbol - 0x100);
  };

  const decodeDistance = (len: number): number => {
    const lenState = Math.min(len, NUM_LEN_TO_POS_STATES - 1);
    const slot = rc.tree(posSlot, lenState << 6, 6);
    if (slot < 4) return slot;
    const numDirectBits = (slot >>> 1) - 1;
    let dist = ((2 | (slot & 1)) << numDirectBits) >>> 0;
    if (slot < END_POS_MODEL_INDEX) {
      dist += rc.reverseTree(posDecoders, dist - slot, numDirectBits);
    } else {
      dist += rc.direct(numDirectBits - NUM_ALIGN_BITS) << NUM_ALIGN_BITS;
      dist += rc.reverseTree(align, 0, NUM_ALIGN_BITS);
    }
    return dist >>> 0;
  };

  let rep0 = 0;
  let rep1 = 0;
  let rep2 = 0;
  let rep3 = 0;
  let state = 0;
  const pbMask = (1 << pb) - 1;

  for (;;) {
    if (sizeKnown && out.length === unpackSize) break;
    const posState = out.length & pbMask;
    if (rc.bit(isMatch, (state << POS_BITS_MAX) + posState) === 0) {
      decodeLiteral(state, rep0);
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let len: number;
    if (rc.bit(isRep, state) !== 0) {
      if (out.length === 0) throw new Error("LZMA: data error");
      if (rc.bit(isRepG0, state) === 0) {
        if (rc.bit(isRep0Long, (state << POS_BITS_MAX) + posState) === 0) {
          state = state < 7 ? 9 : 11;
          out.push(getByte(rep0 + 1));
          continue;
        }
      } else {
        let dist: number;
        if (rc.bit(isRepG1, state) === 0) {
          dist = rep1;
        } else {
          if (rc.bit(isRepG2, state) === 0) {
            dist = rep2;
          } else {
            dist = rep3;
            rep3 = rep2;
          }
          rep2 = rep1;
        }
        rep1 = rep0;
        rep0 = dist;
      }
      len = repLenDecoder.decode(rc, posState);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2;
      rep2 = rep1;
      rep1 = rep0;
      len = lenDecoder.decode(rc, posState);
      state = state < 7 ? 7 : 10;
      rep0 = decodeDistance(len);
      if (rep0 === 0xffffffff) {
        if (!rc.finishedOk) throw new Error("LZMA: bad end marker");
        break;
      }
      if (rep0 >= dictSize || rep0 >= out.length) throw new Error("LZMA: distance out of range");
    }
    len += MATCH_MIN_LEN;
    if (sizeKnown && unpackSize - out.length < len) throw new Error("LZMA: output longer than declared");
    for (let i = 0; i < len; i++) out.push(getByte(rep0 + 1));
  }
  return Uint8Array.from(out);
}
