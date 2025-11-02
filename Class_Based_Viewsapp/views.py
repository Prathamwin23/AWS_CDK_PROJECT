from django.shortcuts import render
from django.views.generic import View  ,ListView,TemplateView,DetailView,CreateView,UpdateView,DeleteView
from django.http import HttpResponse
from Class_Based_Viewsapp.models import Comapny
from django.urls import reverse_lazy
# Create your views here.

# class className(View):
#     def get (self,request):
#         return HttpResponse("<h1> This is case Based View")

class Myclass(TemplateView):
    template_name = "index.html"

class  Allcompanies(ListView):
    model = Comapny

class companydetails(DetailView):
    model = Comapny
    context_object_name="mycompanies"


class AddNewCompany(CreateView):
    model=Comapny
    fields="__all__"
class CompanyUpdate(UpdateView):
    model=Comapny
    fields=["Name","ceo"]


class CompanyDelete(DeleteView):
    model=Comapny
    success_url=reverse_lazy("list")

