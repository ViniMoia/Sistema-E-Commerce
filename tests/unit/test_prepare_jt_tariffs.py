import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'materiais/J&T/Tabela/TABELA_COMERCIAL_OFICIAL_TF2026.xlsx'
spec = importlib.util.spec_from_file_location('prepare_jt', ROOT / 'scripts/prepare-jt-tariffs.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@unittest.skipUnless(SOURCE.exists(), 'Private commercial workbook is not available')
class JtTablePreparationTests(unittest.TestCase):
    def test_extracts_all_rates_and_preserves_source_precision(self):
        records, audit = module.read_table(SOURCE)
        self.assertEqual(len(records), 5181)
        self.assertEqual(audit['geocomCount'], 157)
        self.assertFalse(audit['readyForCheckout'])
        self.assertFalse(audit['databaseChanged'])
        para = [r for r in records if r['geocom'] == 'PA-CAP']
        self.assertEqual(len(para), 33)
        self.assertEqual(para[1]['sourceCell'], 'CV12')
        self.assertEqual(para[1]['weightMin'], '0.251')
        self.assertEqual(para[1]['weightMax'], '0.500')
        self.assertEqual(para[1]['basePrice'], '12.00')
        self.assertEqual(para[2]['basePrice'], '15.81')
        self.assertEqual(para[2]['basePriceRaw'], '15.80894117647059')
        self.assertEqual(para[-1]['weightMax'], '30.000')
        self.assertEqual(para[-1]['additionalKgPrice'], '11.15')

    def test_csv_and_audit_are_reproducible(self):
        with tempfile.TemporaryDirectory(prefix='jt-tariff-test-') as tmp:
            module.prepare(SOURCE, tmp)
            directory = Path(tmp)
            first = {f.name: f.read_bytes() for f in directory.iterdir()}
            module.prepare(SOURCE, tmp)
            self.assertEqual(first, {f.name: f.read_bytes() for f in directory.iterdir()})
            with (directory / 'tarifas-revisao.csv').open(encoding='utf-8-sig', newline='') as file:
                self.assertEqual(len(list(csv.DictReader(file, delimiter=';'))), 5181)
            audit = json.loads((directory / 'auditoria.json').read_text(encoding='utf-8'))
            self.assertEqual(len(audit['missingForActivation']), 4)

    def test_changed_layout_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='jt-tariff-test-') as tmp:
            changed = Path(tmp) / 'changed.xlsx'
            with ZipFile(SOURCE) as source, ZipFile(changed, 'w') as output:
                for name in source.namelist():
                    data = source.read(name)
                    if name == 'xl/sharedStrings.xml':
                        data = data.replace(b'GEOCOM', b'UNKNOWN')
                    output.writestr(name, data)
            with self.assertRaisesRegex(ValueError, 'layout'):
                module.read_table(changed)


class JtDecimalTests(unittest.TestCase):
    def test_rounding_and_invalid_values(self):
        self.assertEqual(module.fixed('12.345', '0.01'), '12.35')
        self.assertEqual(module.fixed('1.0009999999999999', '0.001'), '1.001')
        for value in ['NaN', 'Infinity', '-1']:
            with self.assertRaises(ValueError):
                module.decimal_value(value)


if __name__ == '__main__':
    unittest.main()
