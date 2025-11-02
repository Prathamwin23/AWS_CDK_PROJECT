from django.urls import path
from . import views

urlpatterns = [
    path('', views.Allcompanies.as_view(), name='list'),
    path('<int:pk>/', views.companydetails.as_view(), name='detail'),
    path('create/', views.AddNewCompany.as_view(), name='add'),
    path('update/<int:pk>/', views.CompanyUpdate.as_view(), name='update'),
    path('delete/<int:pk>/', views.CompanyDelete.as_view(), name='delete'),
]
