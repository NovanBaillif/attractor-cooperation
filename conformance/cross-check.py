"""Independent recomputation of every commitment and receipt digest in cases.json.

Written in Python so that the canonical form (RFC 8785 subset: sorted keys, no spaces, UTF-8)
is not checked by the same code that produced it. Run: python cross-check.py
"""
import hashlib
import json
import pathlib
import sys

CASES = pathlib.Path(__file__).with_name("cases.json")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    suite = json.loads(CASES.read_text(encoding="utf-8"))
    checked, mismatches = 0, []
    for case in suite["cases"]:
        if case["kind"] not in ("reveal", "drift") or "reveal" not in case["input"]:
            continue
        sent, receipt, reveal = case["input"]["sent"], case["input"]["receipt"], case["input"]["reveal"]
        seals = {f["id"]: f["sealed"]["commitment"] for f in sent["fields"] if "sealed" in f}
        digest_ok = sha256(canonical(receipt)) == reveal["receiptDigest"]
        opened = {}
        for item in reveal["reveals"]:
            preimage = canonical({"field": item["field"], "salt": item["salt"], "value": item["value"]})
            opened[item["field"]] = sha256(preimage) == seals.get(item["field"])
        expected = case["expected"]
        want_digest_ok = "receipt-digest-mismatch" not in expected.get("violations", [])
        want_opened = {r["field"]: r["commitment"] == "match" for r in expected.get("results", [])}
        if digest_ok != want_digest_ok:
            mismatches.append(f"{case['id']}: digest {digest_ok}, expected {want_digest_ok}")
        for field, ok in want_opened.items():
            if opened.get(field) != ok:
                mismatches.append(f"{case['id']}: commitment {field} {opened.get(field)}, expected {ok}")
        checked += 1
    print(json.dumps({"cases_checked": checked, "mismatches": mismatches}, indent=2))
    sys.exit(1 if mismatches else 0)


if __name__ == "__main__":
    main()
