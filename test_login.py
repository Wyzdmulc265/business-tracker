from app import app

with app.test_client() as client:
    # Get login page
    response = client.get('/login')
    print(f'Login page status: {response.status_code}')
    html = response.data.decode()
    
    # Extract CSRF token
    token_start = html.find('name="csrf_token" value="')
    if token_start == -1:
        print('CSRF token not found in HTML')
        print(f'HTML preview: {html[:500]}')
        exit(1)
    token_start += len('name="csrf_token" value="')
    token_end = html.find('"', token_start)
    csrf_token = html[token_start:token_end]
    print(f'CSRF token found: {csrf_token[:20]}...')
    
    # Try to login
    login_data = {
        'csrf_token': csrf_token,
        'username': 'superadmin',
        'password': 'admin123'
    }
    response = client.post('/login', data=login_data, follow_redirects=False)
    print(f'Login response status: {response.status_code}')
    print(f'Login response headers: {dict(response.headers)}')
    
    # Check if we got redirected to dashboard
    if response.status_code == 302 and '/dashboard' in response.location:
        print('SUCCESS: Login successful, redirected to dashboard')
    else:
        print(f'Response data: {response.data[:500]}')
