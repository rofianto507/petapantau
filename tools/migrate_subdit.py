"""
Migrasi satu kali: isi subdit_id pada record strong_point dan patroli lama
yang dibuat oleh user subdit (create_uid) sebelum field subdit_id ditambahkan.

Jalankan via Odoo shell:
    python odoo-bin shell -d NAMA_DATABASE < addons/petapantau/tools/migrate_subdit.py

Pastikan semua user group_subdit_patroli sudah diset subdit_id-nya
di backend (Configuration > Users) sebelum menjalankan script ini.
"""

# env sudah tersedia otomatis di Odoo shell

# ── Strong Point ──────────────────────────────────────────────────────────────
sp_records = env['petapantau.strong_point'].sudo().search([
    ('subdit_id', '=', False),
    ('create_uid.subdit_id', '!=', False),
])
count_sp = 0
for rec in sp_records:
    rec.sudo().write({'subdit_id': rec.create_uid.subdit_id.id})
    count_sp += 1

# ── Patroli ───────────────────────────────────────────────────────────────────
pt_records = env['petapantau.patroli'].sudo().search([
    ('subdit_id', '=', False),
    ('create_uid.subdit_id', '!=', False),
])
count_pt = 0
for rec in pt_records:
    rec.sudo().write({'subdit_id': rec.create_uid.subdit_id.id})
    count_pt += 1

env.cr.commit()
print(f"Migrasi selesai: {count_sp} strong_point, {count_pt} patroli diupdate.")
