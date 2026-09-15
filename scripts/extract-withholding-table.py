"""Extract the official 2026 withholding PDF to JSON on stdout.

Source: https://www.law.go.kr/LSW/flDownload.do?flSeq=164357181
Usage: python3 scripts/extract-withholding-table.py /path/to/source.pdf
Requires pdfplumber. The caller reviews and saves the generated data.
"""

import hashlib
import json
import re
import sys

import pdfplumber


def integer(value):
    return 0 if value.strip() == "-" else int(value.replace(",", "").strip())


rows = []
at_ten_million = None
with pdfplumber.open(sys.argv[1]) as document:
    for page in document.pages[1:]:
        for table in page.extract_tables():
            for row in table:
                if len(row) != 13 or not row[0]:
                    continue
                if re.fullmatch(r"[\d,]+", row[0].strip()):
                    assert row[1] and all(value is not None for value in row[2:])
                    rows.append([integer(value) for value in row])
                elif row[0].strip() == "10,000천원":
                    at_ten_million = [integer(value) for value in row[2:]]

assert rows[0][0] == 770 and rows[-1][1] == 10000
assert all(len(row) == 13 and row[0] < row[1] for row in rows)
assert all(left[1] == right[0] for left, right in zip(rows, rows[1:]))
assert at_ten_million and len(at_ten_million) == 11
assert next(row for row in rows if row[0] == 9960)[2:4] == [1497170, 1421380]
with open(sys.argv[1], "rb") as source:
    checksum = hashlib.sha256(source.read()).hexdigest()
print(json.dumps({"sha256": checksum, "rows": rows, "atTenMillion": at_ten_million}))
