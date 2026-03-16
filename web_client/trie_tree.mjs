class TrieNode {
  constructor() {
    this.children = {}; // Stores character keys and TrieNode values
    this.isEndOfWord = false;
  }
}

export class TrieTree {
  constructor() {
    this.root = new TrieNode();
  }

  // Adds a string to the tree
  Add(word) {
    let current = this.root;
    for (const char of word) {
      if (!current.children[char]) {
        current.children[char] = new TrieNode();
      }
      current = current.children[char];
    }
    current.isEndOfWord = true;
  }

  // Checks if the exact string exists in the tree
  ContainsString(word) {
    let current = this.root;
    for (const char of word) {
      if (!current.children[char]) {
        return false;
      }
      current = current.children[char];
    }
    return current.isEndOfWord;
  }

  // Removes a string (simplified version)
  Remove(word) {
    this._remove(this.root, word, 0);
  }

  _remove(node, word, index) {
    if (index === word.length) {
      if (!node.isEndOfWord) return false;
      node.isEndOfWord = false;
      // Return true if node has no other children (can be deleted)
      return Object.keys(node.children).length === 0;
    }

    const char = word[index];
    const nextNode = node.children[char];
    if (!nextNode) return false;

    const shouldDeleteChild = this._remove(nextNode, word, index + 1);

    if (shouldDeleteChild) {
      delete node.children[char];
      return Object.keys(node.children).length === 0 && !node.isEndOfWord;
    }

    return false;
  }


	Print() {
    console.log("ROOT");
    this._printRecursive(this.root, 0);
  }

  _printRecursive(node, level) {
    const indent = "  ".repeat(level + 1);
    
    for (const char in node.children) {
      const childNode = node.children[char];
      const isWordEnd = childNode.isEndOfWord ? " (word)*" : "";
      
      console.log(`${indent}└─ ${char}${isWordEnd}`);
      
      // Dive deeper into the tree
      this._printRecursive(childNode, level + 1);
    }
  }

	// Returns all words in the tree as a flat array of strings
  ToArray() {
    const words = [];
    this._traverse(this.root, "", words);
    return words;
  }

  _traverse(node, currentWord, words) {
    // If this node marks the end of a word, add the accumulated string to our list
    if (node.isEndOfWord) {
      words.push(currentWord);
    }

    // Explore all children of the current node
    for (const char in node.children) {
      this._traverse(node.children[char], currentWord + char, words);
    }
  }
}
