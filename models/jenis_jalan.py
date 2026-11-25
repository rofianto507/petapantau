from odoo import models, fields

class JenisJalan(models.Model):
    _name = 'petapantau.jenis_jalan'
    _description = 'Jenis Jalan'

    name = fields.Char(string="Nama", required=True)
    keterangan = fields.Text(string="Keterangan")