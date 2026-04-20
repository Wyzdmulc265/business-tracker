from app import app
import re

with app.test_client() as client:
    # Login first
    response = client.get('/login')
    html = response.data.decode()
    csrf_token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
    
    # Login
    client.post('/login', data={
        'csrf_token': csrf_token,
        'username': 'admin',
        'password': 'admin123'
    })
    
    # Get add transaction page
    response = client.get('/add')
    html = response.data.decode()
    csrf_token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
    
    # Try to add transaction
    response = client.post('/add', data={
        'csrf_token': csrf_token,
        'type': 'sale',
        'amount': '100.00',
        'category_id': '1',
        'description': 'Test Transaction',
        'date': '2026-04-20'
    })
    
    print(f'Add transaction response status: {response.status_code}')
    print(f'Add transaction response location: {response.location}')
    
    # Check history
    response = client.get('/history')
    if b'Test Transaction' in response.data:
        print('SUCCESS: Transaction added correctly')
    else:
        print(f'History page content: {response.data[:500]}')
