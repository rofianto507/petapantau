from odoo import models, fields


class ResUsers(models.Model):
    _inherit = 'res.users'

    polres_id = fields.Many2one(
        'petapantau.polres',
        string='Polres',
        help='Isi jika pengguna ini adalah operator tingkat Polres.',
    )
    polsek_id = fields.Many2one(
        'petapantau.polsek',
        string='Polsek',
        domain="[('polres_id', '=', polres_id)]",
        help='Isi jika pengguna ini adalah operator tingkat Polsek.',
    )
    subdit_id = fields.Many2one(
        'petapantau.subdit',
        string='Subdit',
        help='Isi jika pengguna ini adalah operator Subdit.',
    )

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['polres_id', 'polsek_id', 'subdit_id']

    # polres_id / polsek_id / subdit_id menentukan cakupan data (record rule),
    # jadi sengaja TIDAK dimasukkan ke SELF_WRITEABLE_FIELDS: user tidak boleh
    # mengubah cakupannya sendiri. Hanya administrator yang boleh mengubahnya.
