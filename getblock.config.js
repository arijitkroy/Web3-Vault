class Token {
  constructor(material) {
    this.material = material;
  }

  go() {
    return `https://go.getblock.io/${this.material}/`;
  }

  token() {
    return this.material;
  }
}

export const getblock = {
  shared: {
    eth: {
      sepolia: {
        jsonRpc: [
          new Token("b603d6e1018048109dafb98b8f177783")
        ]
      }
    }
  }
};
