"""Generate synthetic HackAlem input documents from the supplied catalogue.

Run from the repository root: backend/.venv/bin/python out/generate_examples.py
No network, model calls, prices, stock, payment data or real customer data.
"""

import csv
import hashlib
import io
import json
import os
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import pymupdf
from docx import Document
from docx.shared import Inches

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent
INPUTS = OUT / "inputs"
SEED = ROOT / "docs/source of truth/assets"
FONT = Path(
    os.getenv("EXAMPLE_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
)
SELECTION = [("027005", 2), ("027028", 1)]


def selected_rows():
    products = [
        p
        for f in sorted(SEED.glob("products*.json"))
        for p in json.loads(f.read_text())["items"]
    ]
    rows = []
    for code, quantity in SELECTION:
        product = next(p for p in products if p["name"].split()[0] == code)
        rows.append(
            {
                "code": code,
                "article": product["article"],
                "id": product["id"],
                "name": product["name"],
                "quantity": quantity,
            }
        )
    return rows


def write_excel(rows):
    # Minimal standard Office Open XML. Codes are inline strings, never numbers.
    values = [
        ["Код производителя", "Артикул каталога", "Наименование", "Количество, шт."]
    ]
    values.extend([[r["code"], r["article"], r["name"], r["quantity"]] for r in rows])
    cells = []
    for row_number, row in enumerate(values, 1):
        columns = []
        for column, value in zip("ABCD", row, strict=True):
            ref = f"{column}{row_number}"
            columns.append(
                f'<c r="{ref}"><v>{value}</v></c>'
                if isinstance(value, int)
                else f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'
            )
        cells.append(f'<row r="{row_number}">{"".join(columns)}</row>')
    parts = {
        "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Учебная спецификация" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="24" customWidth="1"/><col min="3" max="3" width="62" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/></cols><sheetData>'
        + "".join(cells)
        + "</sheetData></worksheet>",
    }
    with zipfile.ZipFile(
        INPUTS / "specification.xlsx", "w", zipfile.ZIP_DEFLATED
    ) as archive:
        for name, content in parts.items():
            archive.writestr(
                name,
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content,
            )


def write_word(rows):
    doc = Document()
    doc.core_properties.title = "Учебная спецификация HackAlem"
    doc.core_properties.author = "HackAlem prototype — synthetic example"
    doc.add_heading("Учебная спецификация", 0)
    doc.add_paragraph(
        "Синтетический пример запроса покупателя. Не заказ и не платёжный документ."
    )
    table = doc.add_table(rows=1, cols=4)
    table.style = "Light Shading Accent 1"
    for cell, text in zip(
        table.rows[0].cells, ["Код", "Артикул", "Товар", "Шт."], strict=True
    ):
        cell.text = text
    for row in rows:
        for cell, value in zip(
            table.add_row().cells,
            [row["code"], row["article"], row["name"], row["quantity"]],
            strict=True,
        ):
            cell.text = str(value)
    doc.add_paragraph(
        "Цену, характеристики и остаток нужно проверить по каталогу на момент обращения."
    )
    for section in doc.sections:
        section.left_margin = section.right_margin = Inches(0.65)
    doc.save(INPUTS / "specification.docx")


def write_visuals(rows):
    if not FONT.exists():
        raise SystemExit("Set EXAMPLE_FONT to a Cyrillic TTF font path")
    pdf = pymupdf.open()
    page = pdf.new_page(width=595, height=842)
    page.insert_font(fontname="example", fontfile=str(FONT))
    page.draw_rect(pymupdf.Rect(0, 0, 595, 112), color=None, fill=(0.08, 0.23, 0.19))
    page.insert_text(
        (40, 45),
        "HACKALEM / EKT",
        fontname="example",
        fontsize=16,
        color=(0.85, 1, 0.65),
    )
    page.insert_text(
        (40, 82),
        "Учебная спецификация",
        fontname="example",
        fontsize=22,
        color=(1, 1, 1),
    )
    page.insert_text(
        (40, 148),
        "Синтетические данные запроса. Не заказ и не счёт.",
        fontname="example",
        fontsize=11,
    )
    for i, row in enumerate(rows):
        top = 185 + i * 180
        page.draw_rect(
            pymupdf.Rect(35, top, 560, top + 155),
            color=(0.8, 0.84, 0.81),
            fill=(0.97, 0.98, 0.96),
        )
        lines = [
            (f"Позиция {i + 1} · Код: {row['code']}", 16),
            (f"Артикул каталога: {row['article']}", 12),
            (row["name"], 10),
            (f"Количество: {row['quantity']} шт.", 15),
        ]
        for j, (text, size) in enumerate(lines):
            page.insert_text(
                (50, top + 30 + j * 32), text, fontname="example", fontsize=size
            )
    page.insert_textbox(
        pymupdf.Rect(40, 585, 555, 710),
        "Цена, наличие, характеристики и документы запрашиваются из каталога. Количество в спецификации само по себе не является согласием на изменение корзины.",
        fontname="example",
        fontsize=12,
        lineheight=1.6,
    )
    pdf.save(INPUTS / "specification.pdf", deflate=True)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    jpeg = pix.tobytes("jpeg", jpg_quality=92)
    (INPUTS / "specification.jpeg").write_bytes(jpeg)
    scan = pymupdf.open()
    scan_page = scan.new_page(width=595, height=842)
    scan_page.insert_image(scan_page.rect, stream=jpeg)
    scan.save(INPUTS / "specification-scan.pdf", deflate=True)
    scan.close()
    pdf.close()


def main():
    INPUTS.mkdir(exist_ok=True)
    rows = selected_rows()
    write_excel(rows)
    write_word(rows)
    write_visuals(rows)
    plain = "Учебная спецификация. Синтетический запрос.\n" + "\n".join(
        f"{r['code']} | {r['article']} | {r['name']} | {r['quantity']} шт."
        for r in rows
    )
    (INPUTS / "specification.txt").write_text(plain + "\n", encoding="utf-8")
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(
        ["Код производителя", "Артикул каталога", "Наименование", "Количество"]
    )
    for r in rows:
        writer.writerow([r["code"], r["article"], r["name"], r["quantity"]])
    (INPUTS / "specification.csv").write_text(stream.getvalue(), encoding="utf-8-sig")
    manifest = {
        "kind": "synthetic_inputs_and_expected_semantics_not_live_answers",
        "requirements": "HackAlem Word sections 3–7, 9; UC-01…05",
        "prompt": "Покажи наличие и характеристики всех позиций из вложения.",
        "expected_items": rows,
        "cart_before_explicit_confirmation": "unchanged",
        "quantities_are_synthetic": True,
        "prices_and_stock": "read from live catalog, never from these examples",
        "files": [
            {
                "path": f"inputs/{p.name}",
                "size_bytes": p.stat().st_size,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "required_input_family": p.suffix not in {".txt", ".csv"},
            }
            for p in sorted(INPUTS.glob("specification*"))
        ],
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        f"Generated {len(manifest['files'])} input files and manifest; codes preserved as text."
    )


if __name__ == "__main__":
    main()
