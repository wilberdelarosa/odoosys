import crypto from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';

class Digest {
  private sortElements(elements: unknown) {
    const comparator = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const items = Array.from(elements as ArrayLike<string>);
    return items.sort(comparator);
  }

  getHash(xml: string) {
    const doc = new DOMParser().parseFromString(xml) as Document & {
      childNodes: ArrayLike<{ attributes: Record<string, unknown> }>;
      toString(): string;
    };
    const attrs = doc.childNodes[0].attributes;
    const items = this.sortElements(attrs);
    Object.assign(doc.childNodes[0].attributes, items);

    const shasum = crypto.createHash('sha256');
    shasum.update(doc.toString(), 'utf8');
    return shasum.digest('base64');
  }

  getAlgorithmName() {
    return 'http://www.w3.org/2001/04/xmlenc#sha256';
  }
}

export default Digest;