"""Extract TF2026 rates for review; never connects to or changes a database.

Usage: python scripts/prepare-jt-tariffs.py workbook.xlsx output-directory
The CSV is NOT an activation package: coverage, deadlines and tax treatment
must be supplied separately. Requires only Python's standard library.
"""
import csv
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zipfile import ZipFile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def decimal_value(value):
    number = Decimal(value)
    if not number.is_finite() or number < 0:
        raise ValueError("Invalid nonnegative numeric cell")
    return number


def fixed(value, places):
    return format(decimal_value(value).quantize(Decimal(places), rounding=ROUND_HALF_UP), "f")


def read_table(source):
    with ZipFile(source) as archive:
        strings = ["".join(node.itertext()) for node in ET.fromstring(
            archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(
            archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = workbook.findall("s:sheets/s:sheet", NS)
        sheet = next(s for s in sheets if s.attrib["name"] == "PROPOSTA PADRÃO")
        target = relationships[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target
        root = ET.fromstring(archive.read(target))
        cells = {}
        for cell in root.findall("s:sheetData/s:row/s:c", NS):
            value = cell.find("s:v", NS)
            if cell.find("s:f", NS) is not None and (value is None or value.text is None):
                raise ValueError("Formula without cached value: " + cell.attrib["r"])
            if value is not None and value.text is not None:
                cells[cell.attrib["r"]] = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
            elif cell.find("s:is", NS) is not None:
                cells[cell.attrib["r"]] = "".join(cell.find("s:is", NS).itertext())

    # Fixed source layout, fail instead of guessing after structural changes.
    if cells.get("B9") != "GEOCOM" or cells.get("B44") != "Adicional por Kg":
        raise ValueError("Unexpected TF2026 layout")
    columns = [(ref[:-1], value) for ref, value in cells.items()
               if re.fullmatch(r"[A-Z]+9", ref) and ref != "B9"]
    codes = [value for _, value in columns]
    if len(codes) != 157 or len(set(codes)) != len(codes):
        raise ValueError("Expected 157 unique GEOCOM columns")
    records = []
    region = None
    for col, geocom in columns:
        region = cells.get(col + "8", region)
        if not region or not re.fullmatch(r"[A-Z]{2}(?:-(?:CAP\d*|INT[1-4]|RED))?", geocom):
            raise ValueError("Invalid region or GEOCOM: " + geocom)
        previous_max = None
        for row in range(11, 44):
            low = fixed(cells["B" + str(row)], "0.001")
            high = fixed(cells["C" + str(row)], "0.001")
            if Decimal(high) <= Decimal(low) or (previous_max is not None and Decimal(low) != previous_max + Decimal("0.001")):
                raise ValueError("Noncontiguous weight bands at row " + str(row))
            previous_max = Decimal(high)
            price = cells[col + str(row)]
            additional = cells[col + "44"]
            if decimal_value(price) <= 0 or decimal_value(additional) <= 0:
                raise ValueError("Missing/zero tariff at " + col + str(row))
            records.append({"geocom": geocom, "macroRegion": region,
                "weightMin": low, "weightMax": high,
                "basePrice": fixed(price, "0.01"), "basePriceRaw": price,
                "additionalKgPrice": fixed(additional, "0.01"), "additionalKgPriceRaw": additional,
                "sourceCell": col + str(row), "additionalSourceCell": col + "44"})
        if previous_max != Decimal("30"):
            raise ValueError("Unexpected maximum weight")
    return records, {"sourceFile": Path(source).name,
        "sourceSha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
        "sheet": sheet.attrib["name"], "geocomCount": len(codes),
        "weightBandCount": 33, "rateCount": len(records),
        "priceRounding": "ROUND_HALF_UP to 2 decimals; original values preserved in CSV",
        "databaseChanged": False, "readyForCheckout": False,
        "missingForActivation": ["CEP to GEOCOM mapping", "Delivery deadlines and counting rules",
            "Risk-zone mapping", "Confirmation of ICMS inclusion/calculation"],
        "commercialNotes": {ref: value for ref, value in cells.items()
                            if re.fullmatch(r"B(?:4[6-9]|5\d|6[0-3])", ref)}}


def prepare(source, destination):
    records, report = read_table(source)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with (destination / "tarifas-revisao.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(records)
    (destination / "auditoria.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/prepare-jt-tariffs.py workbook.xlsx output-directory")
    report = prepare(sys.argv[1], sys.argv[2])
    print(json.dumps({key: report[key] for key in ["sourceSha256", "geocomCount", "rateCount", "readyForCheckout", "databaseChanged"]}))
