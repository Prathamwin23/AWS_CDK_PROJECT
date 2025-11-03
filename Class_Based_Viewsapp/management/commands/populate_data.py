from django.core.management.base import BaseCommand
from Class_Based_Viewsapp.models import Comapny

class Command(BaseCommand):
    help = 'Populate database with sample companies'

    def handle(self, *args, **options):
        # Clear existing data
        Comapny.objects.all().delete()
        
        # Create sample companies
        companies = [
            {
                'Name': 'Tech Innovations Inc',
                'ceo': 'John Smith',
                'origin': 'Silicon Valley, USA',
                'est_year': 2010
            },
            {
                'Name': 'Global Solutions Ltd',
                'ceo': 'Sarah Johnson',
                'origin': 'London, UK',
                'est_year': 2015
            },
            {
                'Name': 'Digital Dynamics Corp',
                'ceo': 'Michael Chen',
                'origin': 'Tokyo, Japan',
                'est_year': 2018
            },
            {
                'Name': 'Future Systems',
                'ceo': 'Emily Davis',
                'origin': 'Berlin, Germany',
                'est_year': 2020
            }
        ]
        
        for company_data in companies:
            company = Comapny.objects.create(**company_data)
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created company: {company.Name}')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully populated {len(companies)} companies')
        )