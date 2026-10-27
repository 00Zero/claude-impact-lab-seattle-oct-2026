import importlib


def test_packages_import() -> None:
    for name in ("receipts", "receipts.guard", "receipts.verify", "receipts.stop"):
        importlib.import_module(name)
