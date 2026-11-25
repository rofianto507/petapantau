from odoo import models, fields

class JenisTKP(models.Model):
    _name = 'petapantau.jenis_tkp'
    _description = 'Jenis TKP'

    name = fields.Char(string="Nama", required=True)
    keterangan = fields.Text(string="Keterangan")