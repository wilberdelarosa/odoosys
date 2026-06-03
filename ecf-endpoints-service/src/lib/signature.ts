import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

import Digest from './digest.js';

export type DgiDocumentType =
  | 'SemillaModel'
  | 'ECF'
  | 'RFCE'
  | 'ARECF'
  | 'ACECF'
  | 'ANECF'
  | (string & {});

class Signature {
  constructor(
    private readonly privateKey: string,
    private readonly certificatePem: string
  ) {}

  private cleanNodes(node: Node & { childNodes: NodeListOf<ChildNode> }) {
    for (let index = 0; index < node.childNodes.length; index += 1) {
      const child = node.childNodes[index] as ChildNode & { nodeValue: string | null };
      if (
        child.nodeType === 8 ||
        (child.nodeType === 3 && !/\S/.test(child.nodeValue || ''))
      ) {
        node.removeChild(child);
        index -= 1;
      } else if (child.nodeType === 1) {
        this.cleanNodes(child as Node & { childNodes: NodeListOf<ChildNode> });
      }
    }
  }

  private parseXmlStrict(xml: string) {
    let parseError: string | null = null;

    const errorHandler = {
      warning: () => undefined,
      error: (message: string) => {
        parseError = message;
      },
      fatalError: (message: string) => {
        parseError = message;
      },
    };

    const doc = new DOMParser({ errorHandler }).parseFromString(
      xml,
      'text/xml'
    ) as Document;

    if (parseError) {
      throw new Error(`Invalid XML: ${parseError}`);
    }

    const rootElement = doc.documentElement;
    if (!rootElement) {
      throw new Error('Unable to parse XML or find root element');
    }

    if (
      rootElement.nodeName === 'parsererror' ||
      rootElement.localName === 'parsererror'
    ) {
      throw new Error(`Invalid XML: ${rootElement.textContent || 'Parse error'}`);
    }

    return doc;
  }

  signXml(xml: string, rootElementName?: DgiDocumentType) {
    const doc = this.parseXmlStrict(xml);
    const elementName =
      rootElementName || doc.documentElement.localName || doc.documentElement.nodeName;

    const signedXml = new SignedXml({
      privateKey: this.privateKey,
      publicCert: this.certificatePem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm:
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    signedXml.HashAlgorithms['http://myDigestAlgorithm'] = Digest;
    signedXml.addReference({
      xpath: `//*[local-name(.)='${elementName}']`,
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
      digestAlgorithm: 'http://myDigestAlgorithm',
      isEmptyUri: true,
    });

    this.cleanNodes(doc as Node & { childNodes: NodeListOf<ChildNode> });
    signedXml.computeSignature(doc.toString());
    return signedXml.getSignedXml();
  }
}

export default Signature;