# api/models.py

from django.db import models

class PaymentRecord(models.Model):
    telegram_id = models.BigIntegerField()
    username = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('paid', 'Paid'), ('used', 'Used')])
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'payment_records'
    
    def __str__(self):
        return f"Payment {self.telegram_id} - {self.status}"