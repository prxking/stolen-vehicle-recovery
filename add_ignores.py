import os  # type: ignore
import glob  # type: ignore
import re  # type: ignore

dirs_to_check = ['.']

def process_file(filepath):
    if not filepath.endswith('.py') or 'node_modules' in filepath or '.venv' in filepath or 'lib/' in filepath or 'bin/' in filepath:
        return
        
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    changed = False
    for i, line in enumerate(lines):
        # Replace pyrefly with type: ignore
        if '# type: ignore' in line:
            lines[i] = line.replace('# type: ignore', '# type: ignore')
            changed = True
            
        # Add type: ignore to imports
        # match `import X` or `from X import Y`
        # but skip if it already has type: ignore or pyright: ignore
        stripped = line.strip()
        if (stripped.startswith('import ') or stripped.startswith('from ')) and not stripped.startswith('from .'):
            if '#' not in line and 'type: ignore' not in line and 'pyright: ignore' not in line:
                # find the end of the line before newline
                line = line.rstrip('\n')
                lines[i] = line + '  # type: ignore\n'
                changed = True
                
    if changed:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        print(f"Updated {filepath}")

for root, _, files in os.walk('.'):
    for f in files:
        process_file(os.path.join(root, f))
