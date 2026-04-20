from app import app

with app.test_client() as client:
    # Get the login page
    resp = client.get('/login')
    print(f'Login page status: {resp.status_code}')
    if resp.status_code != 200:
        print('Failed to get login page')
        exit(1)
    
    # Extract CSRF token from the response data
    data = resp.data.decode('utf-8', errors='ignore')
    token_start = data.find('name="csrf_token" value="')
    if token_start == -1:
        print('CSRF token not found in login page')
        exit(1)
    token_start += len('name="csrf_token" value="')
    token_end = data.find('"', token_start)
    csrf_token = data[token_start:token_end]
    print(f'Extracted CSRF token (first 10 chars): {csrf_token[:10]}')
    
    # Prepare login data
    login_data = {
        'csrf_token': csrf_token,
        'username': 'superadmin',
        'password': 'admin123'
    }
    
    # Post the login form
    resp = client.post('/login', data=login_data, follow_redirects=False)
    print(f'Login response status: {resp.status_code}')
    print(f'Login response headers: {dict(resp.headers)}')
    
    # Check for redirect to dashboard
    if resp.status_code == 302 and '/dashboard' in resp.location:
        print('SUCCESS: Login successful, redirected to dashboard')
    else:
        print(f'Login failed. Response data: {resp.data[:200]}')