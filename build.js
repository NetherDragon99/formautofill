const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'bookmarklet.js');
const distPath = path.join(__dirname, 'form.js');

console.log('Reading source file:', srcPath);
const srcCode = fs.readFileSync(srcPath, 'utf8');

// Tokenize to preserve strings, regexes, and template literals while stripping comments and excess spaces
function minifyJS(code) {
  let output = '';
  let i = 0;
  const n = code.length;

  while (i < n) {
    const c = code[i];

    // Single-line comment
    if (c === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < n && code[i] !== '\n' && code[i] !== '\r') i++;
      continue;
    }

    // Multi-line comment
    if (c === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Strings: single or double quote
    if (c === '"' || c === "'") {
      const quote = c;
      output += quote;
      i++;
      while (i < n) {
        const cur = code[i];
        output += cur;
        if (cur === '\\') {
          i++;
          if (i < n) output += code[i];
        } else if (cur === quote) {
          break;
        }
        i++;
      }
      i++;
      continue;
    }

    // Template literals
    if (c === '`') {
      output += c;
      i++;
      while (i < n) {
        const cur = code[i];
        output += cur;
        if (cur === '\\') {
          i++;
          if (i < n) output += code[i];
        } else if (cur === '`') {
          break;
        }
        i++;
      }
      i++;
      continue;
    }

    // Regular Expression literal detection (heuristic: preceded by punctuation/keyword)
    if (c === '/') {
      const prevNonSpace = output.trimEnd().slice(-1);
      const isRegex = /[(=,;:!&|?{\[\n\r]/.test(prevNonSpace) || prevNonSpace === '' || /return$/.test(output.trimEnd());
      if (isRegex) {
        output += c;
        i++;
        while (i < n) {
          const cur = code[i];
          output += cur;
          if (cur === '\\') {
            i++;
            if (i < n) output += code[i];
          } else if (cur === '/') {
            break;
          }
          i++;
        }
        i++;
        // Regex flags
        while (i < n && /[a-z]/i.test(code[i])) {
          output += code[i];
          i++;
        }
        continue;
      }
    }

    // Whitespace handling
    if (/\s/.test(c)) {
      const lastChar = output.slice(-1);
      if (lastChar && /[a-zA-Z0-9_$]/.test(lastChar)) {
        // Lookahead to check if next non-space char is also alphanumeric
        let j = i;
        while (j < n && /\s/.test(code[j])) j++;
        if (j < n && /[a-zA-Z0-9_$]/.test(code[j])) {
          output += ' ';
        }
      }
      i++;
      continue;
    }

    output += c;
    i++;
  }

  return output.trim();
}

console.log('Minifying bookmarklet code...');
const cleanCode = srcCode.replace(/^javascript:\s*/, '');
const minified = minifyJS(cleanCode);

// Validate JS syntax
try {
  new Function(minified);
  console.log('✔ Syntax validation PASSED!');
} catch (e) {
  console.error('❌ Syntax validation FAILED:', e.message);
  process.exit(1);
}

const finalBookmarklet = 'javascript:' + minified;

fs.writeFileSync(distPath, finalBookmarklet, 'utf8');

console.log('✔ Successfully generated form.js!');
console.log('Original size:', srcCode.length, 'bytes');
console.log('Built size:   ', finalBookmarklet.length, 'bytes');
console.log('Savings:      ', Math.round((1 - finalBookmarklet.length / srcCode.length) * 100) + '%');
