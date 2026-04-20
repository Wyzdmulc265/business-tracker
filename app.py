from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timedelta
import os
from flask_wtf.csrf import CSRFProtect
from flask_wtf import FlaskForm
from wtforms import HiddenField, StringField, PasswordField
from wtforms.validators import DataRequired
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from functools import wraps

# Constants
TRANSACTION_TYPE_SALE = 'sale'
TRANSACTION_TYPE_EXPENSE = 'expense'
MAX_BAR_HEIGHT = 150

# User roles
ROLE_SUPER_ADMIN = 'super_admin'
ROLE_BUSINESS_ADMIN = 'business_admin'
ROLE_ACCOUNTANT = 'accountant'
ROLE_VIEWER = 'viewer'

login_manager = LoginManager()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'profit-tracker-secret-key-2024')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///profit_tracker.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

csrf = CSRFProtect(app)
db = SQLAlchemy(app)
login_manager.init_app(app)
login_manager.login_view = 'login'

class CSRFTokenForm(FlaskForm):
    csrf_token = HiddenField()

# Authentication forms
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    csrf_token = HiddenField()

class RegisterForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired()])
    business_name = StringField('Business Name', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired()])
    csrf_token = HiddenField()

# User Settings Forms
class UserSettingsForm(FlaskForm):
    new_password = PasswordField('New Password (leave blank to keep current)')
    confirm_new_password = PasswordField('Confirm New Password')
    csrf_token = HiddenField()

# Helper functions for common database queries
def get_sum_by_type_and_date(trans_type, target_date, business_id=None):
    """Get sum of transactions by type and specific date"""
    query = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.type == trans_type,
        Transaction.date == target_date,
        Transaction.approval_status == 'approved'
    )
    
    if business_id:
        query = query.filter(Transaction.business_id == business_id)
    
    return query.scalar() or 0

def get_sum_by_type_and_date_range(trans_type, start_date, end_date, business_id=None):
    """Get sum of transactions by type within date range (inclusive)"""
    query = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.type == trans_type,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.approval_status == 'approved'
    )
    
    if business_id:
        query = query.filter(Transaction.business_id == business_id)
    
    return query.scalar() or 0

def role_required(roles):
    """Decorator to require specific roles for a route"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('login', next=request.url))
            if current_user.role not in roles:
                flash('You do not have permission to access this page.', 'error')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Database Models
class Business(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    users = db.relationship('User', backref='business', lazy=True)
    categories = db.relationship('Category', backref='business', lazy=True)
    transactions = db.relationship('Transaction', backref='business', lazy=True)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'sale' or 'expense'
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='viewer')
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    currency = db.Column(db.String(10), default='$')
    date_format = db.Column(db.String(20), default='%b %d, %Y')
    timezone = db.Column(db.String(50), default='UTC')
    theme = db.Column(db.String(20), default='default')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_id(self):
        return str(self.id)
    
    @property
    def is_authenticated(self):
        return True
    
    def is_super_admin(self):
        return self.role == ROLE_SUPER_ADMIN
    
    def is_business_admin(self):
        return self.role == ROLE_BUSINESS_ADMIN
    
    def is_accountant(self):
        return self.role in [ROLE_BUSINESS_ADMIN, ROLE_ACCOUNTANT]
    
    def is_manager(self):
        return self.role in [ROLE_BUSINESS_ADMIN, ROLE_MANAGER]
    
    def has_business_access(self, business_id):
        return self.is_super_admin()
    
    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), nullable=False, index=True)  # 'sale' or 'expense'
    amount = db.Column(db.Float, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    description = db.Column(db.String(200))
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    is_pending = db.Column(db.Boolean, default=False)
    requires_approval = db.Column(db.Boolean, default=False)
    approval_status = db.Column(db.String(20), default='approved')  # approved, pending, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    category = db.relationship('Category', backref=db.backref('transactions', lazy=True))
    creator = db.relationship('User', foreign_keys=[created_by])

# Auth Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = LoginForm()
    if request.method == 'POST' and form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('dashboard'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = RegisterForm()
    if request.method == 'POST' and form.validate_on_submit():
        username = form.username.data
        email = form.email.data
        business_name = form.business_name.data
        password = form.password.data
        confirm_password = form.confirm_password.data
        
        errors = []
        
        if User.query.filter_by(username=username).first():
            errors.append('Username already exists')
        if User.query.filter_by(email=email).first():
            errors.append('Email already exists')
        if Business.query.filter_by(name=business_name).first():
            errors.append('Business name already registered. Please choose a different name.')
        if password != confirm_password:
            errors.append('Passwords do not match')
        if len(password) < 6:
            errors.append('Password must be at least 6 characters')
        
        if errors:
            for error in errors:
                flash(error, 'error')
            return render_template('register.html', form=form)
        
        # Create business first
        business = Business(name=business_name)
        db.session.add(business)
        db.session.flush()  # Get business ID
        
        # Create default categories for business
        sale_categories = ['Product Sales', 'Services', 'Digital Products', 'Other Income']
        expense_categories = ['Inventory/Stock', 'Rent', 'Utilities', 'Transport', 'Marketing', 'Supplies', 'Salaries', 'Other Expense']
        
        for name in sale_categories:
            cat = Category(name=name, type='sale', business_id=business.id)
            db.session.add(cat)
        for name in expense_categories:
            cat = Category(name=name, type='expense', business_id=business.id)
            db.session.add(cat)
        
        # Create business admin user
        from werkzeug.security import generate_password_hash
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role=ROLE_BUSINESS_ADMIN,
            business_id=business.id
        )
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Your business has been created. Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html', form=form)

# Protected Routes
@app.route('/')
@login_required
def dashboard():
    today = date.today()
    business_id = None if current_user.is_super_admin() else current_user.business_id

    # Today's summary
    today_sales = get_sum_by_type_and_date(TRANSACTION_TYPE_SALE, today, business_id)
    today_expenses = get_sum_by_type_and_date(TRANSACTION_TYPE_EXPENSE, today, business_id)
    today_profit = today_sales - today_expenses

    # Monthly summary
    month_start = today.replace(day=1)
    month_sales = get_sum_by_type_and_date_range(TRANSACTION_TYPE_SALE, month_start, today, business_id)
    month_expenses = get_sum_by_type_and_date_range(TRANSACTION_TYPE_EXPENSE, month_start, today, business_id)
    month_profit = month_sales - month_expenses

    # Recent transactions
    query = Transaction.query.filter(Transaction.approval_status == 'approved')
    if business_id:
        query = query.filter(Transaction.business_id == business_id)
    
    recent_transactions = query.order_by(Transaction.date.desc(), Transaction.created_at.desc()).limit(5).all()

    return render_template('index.html',
                           today_sales=today_sales,
                           today_expenses=today_expenses,
                           today_profit=today_profit,
                           month_sales=month_sales,
                           month_expenses=month_expenses,
                           month_profit=month_profit,
                           recent_transactions=recent_transactions)

@app.route('/add', methods=['GET', 'POST'])
@login_required
def add_transaction():
    if request.method == 'POST':
        trans_type = request.form.get('type')
        amount_str = request.form.get('amount')
        category_id_str = request.form.get('category_id')
        description = request.form.get('description')
        trans_date = request.form.get('date')

        # Input validation
        errors = []

        # Validate transaction type
        if not trans_type or trans_type not in ['sale', 'expense']:
            errors.append('Invalid transaction type')

        # Validate amount
        try:
            amount = float(amount_str)
            if amount <= 0:
                errors.append('Amount must be greater than zero')
        except ValueError:
            errors.append('Invalid amount format')

        # Validate category
        try:
            category_id = int(category_id_str)
            category = Category.query.get(category_id)
            if not category:
                errors.append('Invalid category selected')
        except ValueError:
            errors.append('Invalid category selection')

        # Validate date
        if trans_date:
            try:
                trans_date = datetime.strptime(trans_date, '%Y-%m-%d').date()
            except ValueError:
                errors.append('Invalid date format, should be YYYY-MM-DD')
        else:
            trans_date = date.today()

        # Verify category belongs to user's business
        if not current_user.is_super_admin():
            if category.business_id != current_user.business_id:
                errors.append('Invalid category for your business')
        
        if errors:
            for error in errors:
                flash(error, 'error')
            categories = Category.query.filter_by(business_id=current_user.business_id).all()
            return render_template('add_transaction.html', categories=categories, today=date.today().strftime('%Y-%m-%d'))
        
        # Determine approval status
        requires_approval = current_user.role == ROLE_ACCOUNTANT
        approval_status = 'pending' if requires_approval else 'approved'
        
        transaction = Transaction(
            type=trans_type,
            amount=amount,
            category_id=category_id,
            business_id=current_user.business_id,
            created_by=current_user.id,
            description=description,
            date=trans_date,
            requires_approval=requires_approval,
            approval_status=approval_status
        )

        db.session.add(transaction)
        db.session.commit()
        
        if requires_approval:
            flash('Transaction submitted for admin approval.', 'success')
        else:
            flash('Transaction added successfully!', 'success')
        return redirect(url_for('dashboard'))
    
    # Only show categories for user's business
    categories = Category.query.filter_by(business_id=current_user.business_id).all() if not current_user.is_super_admin() else Category.query.all()
    form = CSRFTokenForm()
    return render_template('add_transaction.html', categories=categories, today=date.today().strftime('%Y-%m-%d'), form=form)

@app.route('/history')
@login_required
def history():
    # Filters
    filter_type = request.args.get('type', '')
    filter_category = request.args.get('category', '')
    filter_start = request.args.get('start_date', '')
    filter_end = request.args.get('end_date', '')

    query = Transaction.query
    
    # Filter by business
    if not current_user.is_super_admin():
        query = query.filter(Transaction.business_id == current_user.business_id)

    if filter_type:
        query = query.filter(Transaction.type == filter_type)

    if filter_category:
        query = query.filter(Transaction.category_id == int(filter_category))

    if filter_start:
        start_date = datetime.strptime(filter_start, '%Y-%m-%d').date()
        query = query.filter(Transaction.date >= start_date)

    if filter_end:
        end_date = datetime.strptime(filter_end, '%Y-%m-%d').date()
        query = query.filter(Transaction.date <= end_date)

    transactions = query.order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()
    
    # Filter categories by business
    categories = Category.query.filter_by(business_id=current_user.business_id).all() if not current_user.is_super_admin() else Category.query.all()

    return render_template('history.html',
                          transactions=transactions,
                          categories=categories,
                          filter_type=filter_type,
                          filter_category=filter_category,
                          filter_start=filter_start,
                          filter_end=filter_end)

@app.route('/delete/<int:id>')
@login_required
def delete_transaction(id):
    transaction = Transaction.query.get_or_404(id)
    db.session.delete(transaction)
    db.session.commit()
    flash('Transaction deleted successfully!', 'success')
    return redirect(url_for('history'))

@app.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_transaction(id):
    transaction = Transaction.query.get_or_404(id)

    if request.method == 'POST':
        trans_type = request.form.get('type')
        amount_str = request.form.get('amount')
        category_id_str = request.form.get('category_id')
        description = request.form.get('description')
        trans_date = request.form.get('date')

        # Input validation
        errors = []

        # Validate transaction type
        if not trans_type or trans_type not in ['sale', 'expense']:
            errors.append('Invalid transaction type')

        # Validate amount
        try:
            amount = float(amount_str)
            if amount <= 0:
                errors.append('Amount must be greater than zero')
        except ValueError:
            errors.append('Invalid amount format')

        # Validate category
        try:
            category_id = int(category_id_str)
            category = Category.query.get(category_id)
            if not category:
                errors.append('Invalid category selected')
        except ValueError:
            errors.append('Invalid category selection')

        # Validate date
        if trans_date:
            try:
                trans_date = datetime.strptime(trans_date, '%Y-%m-%d').date()
            except ValueError:
                errors.append('Invalid date format, should be YYYY-MM-DD')
        else:
            trans_date = date.today()

        if errors:
            for error in errors:
                flash(error, 'error')
            categories = Category.query.all()
            return render_template('edit_transaction.html', transaction=transaction, categories=categories, today=date.today().strftime('%Y-%m-%d'))

        transaction.type = trans_type
        transaction.amount = amount
        transaction.category_id = category_id
        transaction.description = description
        transaction.date = trans_date

        # If accountant is editing, require re-approval
        if current_user.role == ROLE_ACCOUNTANT:
            transaction.approval_status = 'pending'
            flash('Transaction updated and submitted for re-approval.', 'success')
        else:
            flash('Transaction updated successfully!', 'success')
            
        db.session.commit()
        return redirect(url_for('history'))

    # Filter categories by business
    categories = Category.query.filter_by(business_id=current_user.business_id).all() if not current_user.is_super_admin() else Category.query.all()
    return render_template('edit_transaction.html', transaction=transaction, categories=categories)

# Transaction Approval Routes
@app.route('/pending-approvals')
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def pending_approvals():
    query = Transaction.query.filter_by(approval_status='pending')
    if not current_user.is_super_admin():
        query = query.filter(Transaction.business_id == current_user.business_id)
    
    transactions = query.order_by(Transaction.created_at.desc()).all()
    return render_template('pending_approvals.html', transactions=transactions)

@app.route('/approve/<int:transaction_id>')
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def approve_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)
    
    # Check business access
    if not current_user.is_super_admin() and transaction.business_id != current_user.business_id:
        flash('You do not have permission to approve this transaction.', 'error')
        return redirect(url_for('dashboard'))
    
    transaction.approval_status = 'approved'
    db.session.commit()
    flash('Transaction approved successfully!', 'success')
    return redirect(url_for('pending_approvals'))

@app.route('/reject/<int:transaction_id>')
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def reject_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)
    
    # Check business access
    if not current_user.is_super_admin() and transaction.business_id != current_user.business_id:
        flash('You do not have permission to reject this transaction.', 'error')
        return redirect(url_for('dashboard'))
    
    transaction.approval_status = 'rejected'
    db.session.commit()
    flash('Transaction rejected.', 'success')
    return redirect(url_for('pending_approvals'))

@app.route('/reports')
@login_required
def reports():
    today = date.today()
    business_id = None if current_user.is_super_admin() else current_user.business_id

    # Daily summary for last 7 days
    daily_summary = []
    daily_max = 1
    for i in range(6, -1, -1):
        day = today - timedelta(days=6-i)

        day_sales = get_sum_by_type_and_date(TRANSACTION_TYPE_SALE, day, business_id)
        day_expenses = get_sum_by_type_and_date(TRANSACTION_TYPE_EXPENSE, day, business_id)

        profit = day_sales - day_expenses
        daily_summary.append({
            'date': day,
            'sales': day_sales,
            'expenses': day_expenses,
            'profit': profit
        })
        if abs(profit) > daily_max:
            daily_max = abs(profit)

    # Normalize bar heights (max BAR_HEIGHT px)
    if daily_max > 0:
        for item in daily_summary:
            item['bar_height'] = (abs(item['profit']) / daily_max) * MAX_BAR_HEIGHT
    else:
        for item in daily_summary:
            item['bar_height'] = 0

    # Monthly totals (last 6 months)
    monthly_totals = []
    monthly_max = 1
    for i in range(5, -1, -1):
        # Calculate first day of the month i months ago
        month_date = today.replace(day=1)
        for _ in range(i):
            if month_date.month == 1:
                month_date = month_date.replace(year=month_date.year-1, month=12)
            else:
                month_date = month_date.replace(month=month_date.month-1)

        # Calculate first day of next month for filtering
        if month_date.month == 12:
            next_month = month_date.replace(year=month_date.year+1, month=1)
        else:
            next_month = month_date.replace(month=month_date.month+1)

        month_sales = get_sum_by_type_and_date_range(TRANSACTION_TYPE_SALE, month_date, next_month - timedelta(days=1), business_id)
        month_expenses = get_sum_by_type_and_date_range(TRANSACTION_TYPE_EXPENSE, month_date, next_month - timedelta(days=1), business_id)

        profit = month_sales - month_expenses
        monthly_totals.append({
            'month': month_date.strftime('%B %Y'),
            'sales': month_sales,
            'expenses': month_expenses,
            'profit': profit
        })
        if abs(profit) > monthly_max:
            monthly_max = abs(profit)

    monthly_totals.reverse()

    # Normalize monthly bar heights
    if monthly_max > 0:
        for item in monthly_totals:
            item['bar_height'] = (abs(item['profit']) / monthly_max) * MAX_BAR_HEIGHT
    else:
        for item in monthly_totals:
            item['bar_height'] = 0

    # Overall stats
    total_sales = get_sum_by_type_and_date_range(TRANSACTION_TYPE_SALE, date(2000, 1, 1), today, business_id)  # From a far past date to today
    total_expenses = get_sum_by_type_and_date_range(TRANSACTION_TYPE_EXPENSE, date(2000, 1, 1), today, business_id)  # From a far past date to today

    return render_template('reports.html',
                           daily_summary=daily_summary,
                           monthly_totals=monthly_totals,
                           total_sales=total_sales,
                           total_expenses=total_expenses,
                           total_profit=total_sales - total_expenses)

# User Management Routes
@app.route('/users')
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def user_management():
    query = User.query
    if not current_user.is_super_admin():
        query = query.filter_by(business_id=current_user.business_id)
    
    users = query.order_by(User.created_at.desc()).all()
    form = CSRFTokenForm()
    return render_template('users.html', users=users, form=form)

@app.route('/user/edit/<int:user_id>', methods=['GET', 'POST'])
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    
    # Check permissions
    if not current_user.is_super_admin() and user.business_id != current_user.business_id:
        flash('You do not have permission to edit this user.', 'error')
        return redirect(url_for('user_management'))
    
    if request.method == 'POST':
        user.username = request.form.get('username')
        user.email = request.form.get('email')
        user.role = request.form.get('role')
        user.is_active = request.form.get('is_active') == '1'
        
        db.session.commit()
        flash('User updated successfully!', 'success')
        return redirect(url_for('user_management'))
    
    return render_template('edit_user.html', user=user, roles=[ROLE_VIEWER, ROLE_ACCOUNTANT, ROLE_BUSINESS_ADMIN])

@app.route('/user/delete/<int:user_id>')
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('You cannot delete your own account!', 'error')
        return redirect(url_for('user_management'))
    
    # Super admins can delete any user, business admins only their own
    if not current_user.is_super_admin() and user.business_id != current_user.business_id:
        flash('You do not have permission to delete this user.', 'error')
        return redirect(url_for('user_management'))
    
    db.session.delete(user)
    db.session.commit()
    flash('User deleted successfully!', 'success')
    return redirect(url_for('user_management'))

@app.route('/user/add', methods=['POST'])
@login_required
@role_required([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN])
def add_user():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    role = request.form.get('role')
    
    errors = []
    if User.query.filter_by(username=username).first():
        errors.append('Username already exists')
    if User.query.filter_by(email=email).first():
        errors.append('Email already exists')
    if len(password) < 6:
        errors.append('Password must be at least 6 characters')
    
    if errors:
        for error in errors:
            flash(error, 'error')
        return redirect(url_for('user_management'))
    
    from werkzeug.security import generate_password_hash
    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        business_id=current_user.business_id
    )
    db.session.add(user)
    db.session.commit()
    
    flash('User added successfully!', 'success')
    return redirect(url_for('user_management'))

# User Profile & Preferences


def init_db():
    with app.app_context():
        db.create_all()
        
        # Create default admin user if none exists
        if User.query.count() == 0:
            from werkzeug.security import generate_password_hash
            admin = User(
                username='superadmin',
                email='superadmin@profittracker.local',
                password_hash=generate_password_hash('admin123'),
                role=ROLE_SUPER_ADMIN
            )
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created (username: admin, password: admin123)")

# Initialize database
init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
