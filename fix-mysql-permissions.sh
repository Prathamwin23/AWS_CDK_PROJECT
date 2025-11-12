#!/bin/bash

# MySQL connection details
DB_HOST="dev-classic-app-db.cfqe002kq5rb.ap-south-1.rds.amazonaws.com"
DB_USER="classicadmin"
DB_PASSWORD="spH4nfnPyFiAlnRTyj3EMtDciABKP0p2"
DB_NAME="classicappdb"

echo "Connecting to MySQL database to fix user permissions..."

# Connect to MySQL and fix user permissions
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "
-- Create user that can connect from any host in VPC
CREATE USER IF NOT EXISTS 'classicadmin'@'10.0.%' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO 'classicadmin'@'10.0.%';

-- Also allow from any host (for flexibility)
CREATE USER IF NOT EXISTS 'classicadmin'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO 'classicadmin'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Show users to confirm
SELECT User, Host FROM mysql.user WHERE User = 'classicadmin';
"

echo "MySQL user permissions updated successfully!"