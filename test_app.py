import pytest
from app import app, db, Category, Transaction, init_db
from datetime import date, datetime


@pytest.fixture
def client():
    """Create a test client for the app"""
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.app_context():
        db.create_all()
        init_db()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


class TestModels:
    """Test database models"""
    
    def test_category_creation(self, client):
        """Test that categories can be created"""
        with app.app_context():
            sale_cat = Category(name='Test Sale', type='sale')
            expense_cat = Category(name='Test Expense', type='expense')
            db.session.add(sale_cat)
            db.session.add(expense_cat)
            db.session.commit()
            
            assert sale_cat.id is not None
            assert expense_cat.id is not None
            assert sale_cat.type == 'sale'
            assert expense_cat.type == 'expense'
    
    def test_transaction_creation(self, client):
        """Test that transactions can be created"""
        with app.app_context():
            # Get an existing category
            category = Category.query.filter_by(type='sale').first()
            
            transaction = Transaction(
                type='sale',
                amount=100.00,
                category_id=category.id,
                description='Test transaction',
                date=date.today()
            )
            db.session.add(transaction)
            db.session.commit()
            
            assert transaction.id is not None
            assert transaction.amount == 100.00
            assert transaction.type == 'sale'
    
    def test_transaction_relationship(self, client):
        """Test transaction-category relationship"""
        with app.app_context():
            category = Category.query.filter_by(type='sale').first()
            
            transaction = Transaction(
                type='sale',
                amount=50.00,
                category_id=category.id,
                date=date.today()
            )
            db.session.add(transaction)
            db.session.commit()
            
            # Check relationship
            assert transaction.category.name == category.name


class TestRoutes:
    """Test application routes"""
    
    def test_dashboard_route(self, client):
        """Test dashboard loads successfully"""
        response = client.get('/')
        assert response.status_code == 200
    
    def test_add_transaction_get(self, client):
        """Test add transaction page loads"""
        response = client.get('/add')
        assert response.status_code == 200
    
    def test_history_route(self, client):
        """Test history page loads"""
        response = client.get('/history')
        assert response.status_code == 200
    
    def test_reports_route(self, client):
        """Test reports page loads"""
        response = client.get('/reports')
        assert response.status_code == 200
    
    def test_add_transaction_post_valid(self, client):
        """Test adding a valid transaction"""
        with app.app_context():
            category = Category.query.filter_by(type='sale').first()
            
            response = client.post('/add', data={
                'type': 'sale',
                'amount': '150.00',
                'category_id': str(category.id),
                'description': 'Test sale',
                'date': str(date.today())
            }, follow_redirects=True)
            
            assert response.status_code == 200
    
    def test_add_transaction_post_invalid_amount(self, client):
        """Test adding transaction with invalid amount"""
        with app.app_context():
            category = Category.query.filter_by(type='sale').first()
            
            response = client.post('/add', data={
                'type': 'sale',
                'amount': '-50.00',  # Negative amount
                'category_id': str(category.id),
                'description': 'Test sale',
                'date': str(date.today())
            })
            
            # Should show error and return to form
            assert response.status_code == 200
    
    def test_delete_transaction(self, client):
        """Test deleting a transaction"""
        with app.app_context():
            category = Category.query.filter_by(type='sale').first()
            
            # Create a transaction first
            transaction = Transaction(
                type='sale',
                amount=100.00,
                category_id=category.id,
                date=date.today()
            )
            db.session.add(transaction)
            db.session.commit()
            transaction_id = transaction.id
            
            # Delete it
            response = client.get(f'/delete/{transaction_id}', follow_redirects=True)
            assert response.status_code == 200
            
            # Verify it's deleted
            deleted = Transaction.query.get(transaction_id)
            assert deleted is None


class TestHelperFunctions:
    """Test helper functions"""
    
    def test_get_sum_by_type_and_date(self, client):
        """Test get_sum_by_type_and_date helper"""
        with app.app_context():
            from app import get_sum_by_type_and_date
            
            category = Category.query.filter_by(type='sale').first()
            
            # Add a transaction
            transaction = Transaction(
                type='sale',
                amount=100.00,
                category_id=category.id,
                date=date.today()
            )
            db.session.add(transaction)
            db.session.commit()
            
            # Test the helper
            total = get_sum_by_type_and_date('sale', date.today())
            assert total == 100.00
    
    def test_get_sum_by_type_and_date_range(self, client):
        """Test get_sum_by_type_and_date_range helper"""
        with app.app_context():
            from app import get_sum_by_type_and_date_range
            
            category = Category.query.filter_by(type='sale').first()
            
            # Add transactions
            t1 = Transaction(
                type='sale',
                amount=100.00,
                category_id=category.id,
                date=date.today()
            )
            t2 = Transaction(
                type='sale',
                amount=200.00,
                category_id=category.id,
                date=date.today()
            )
            db.session.add_all([t1, t2])
            db.session.commit()
            
            # Test the helper
            total = get_sum_by_type_and_date_range('sale', date.today(), date.today())
            assert total == 300.00


class TestConstants:
    """Test that constants are properly defined"""
    
    def test_transaction_type_constants(self, client):
        """Test transaction type constants"""
        from app import TRANSACTION_TYPE_SALE, TRANSACTION_TYPE_EXPENSE, MAX_BAR_HEIGHT
        
        assert TRANSACTION_TYPE_SALE == 'sale'
        assert TRANSACTION_TYPE_EXPENSE == 'expense'
        assert MAX_BAR_HEIGHT == 150