from django.db import models
from django.urls import reverse

# Create your models here.

class Comapny(models.Model):
    Name=models.CharField(max_length=100)
    ceo=models.CharField(max_length=100)
    origin=models.CharField(max_length=100)
    est_year=models.IntegerField()
    def __str__(self):
        return self.Name

    def get_absolute_url(self):
        return reverse("detail",kwargs={"pk":self.pk})

class Product(models.Model):
    Prouct_Name= models.CharField(max_length=100)
    color=models.CharField(max_length=100)
    price=models.IntegerField()
    seat_capacitiy=models.IntegerField()
    fuel_type=models.CharField(max_length=100)
    milage=models.IntegerField()
    Comapny=models.ForeignKey(Comapny,related_name="companies",on_delete=models.CASCADE)




