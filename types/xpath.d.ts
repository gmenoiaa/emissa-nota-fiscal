declare module 'xpath' {
  interface Select {
    (expression: string, node: Node): unknown;
  }
  interface XPath {
    useNamespaces(namespaces: Record<string, string>): Select;
  }
  const xpath: XPath;
  export default xpath;
}
