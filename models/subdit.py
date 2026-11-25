from odoo import models, fields

class Subdit(models.Model):
    _name = 'petapantau.subdit'
    _description = 'Subdit'
    _order = 'name asc'

    name = fields.Char(string='Nama', required=True)
    keterangan = fields.Text(string='Keterangan')
