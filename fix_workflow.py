import re

with open('.github/workflows/deploy-registry.yml', 'r') as f:
    content = f.read()

# Remove the "Configure Anchor to use Solana CLI from PATH" step
content = re.sub(
    r'\s*- name: Configure Anchor to use Solana CLI from PATH\s+run: \|\s+cargo install --git.*?solana --version\s+',
    '\n',
    content,
    flags=re.DOTALL
)

# Remove the "Install Anchor" step
content = re.sub(
    r'\s*- name: Install Anchor\s+run: \|\s+cargo install --git.*?anchor --version\s+',
    '\n',
    content,
    flags=re.DOTALL
)

# Fix the "Setup Node.js" indentation (it has wrong indentation)
content = content.replace('        - name: Setup Node.js', '      - name: Setup Node.js')

with open('.github/workflows/deploy-registry.yml', 'w') as f:
    f.write(content)

print("Workflow file cleaned successfully")
