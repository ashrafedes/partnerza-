const fs = require('fs');
const file = 'frontend/src/pages/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Find and replace the closing of supplier payments tab
const oldString = `            )}
          </div>
        )}

        {/* SETTINGS TAB */}`;

const newString = `            )}

            {/* ORDER DETAILS SECTION */}
            <div className="p-4 border-t border-gray-200 mt-4">
              <h3 className="text-lg font-bold text-amazon-dark mb-3">Order Details</h3>
            </div>
            {orders.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No orders available.</div>
            ) : (
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{order.id}</td>
                        <td className="px-4 py-3">{parseFloat(order.total_amount || 0).toFixed(2)} SAR</td>
                        <td className="px-4 py-3 text-green-700">{parseFloat(order.marketer_commission_amount || 0).toFixed(2)} SAR</td>
                        <td className="px-4 py-3 text-blue-700">{parseFloat(order.platform_fee_amount || 0).toFixed(2)} SAR</td>
                        <td className="px-4 py-3">
                          {(parseFloat(order.total_amount || 0) - parseFloat(order.marketer_commission_amount || 0) - parseFloat(order.platform_fee_amount || 0)).toFixed(2)} SAR
                        </td>
                        <td className="px-4 py-3">
                          <span className={\`px-2 py-1 text-xs rounded-full capitalize \${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }\`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}`;

if (content.includes(oldString)) {
  content = content.replace(oldString, newString);
  fs.writeFileSync(file, content);
  console.log('SUCCESS: Order Details section added to Supplier Payments tab');
} else {
  console.log('ERROR: Could not find the insertion point');
  console.log('Looking for:', oldString.slice(0, 50));
}
