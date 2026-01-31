// Example JavaScript file
// This file demonstrates how PR comments would appear in the IDE

function calculateTotal(items) {
    let total = 0;  // Line 5: Imagine a review comment here suggesting to use const
    
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    
    return total;  // Line 11: Imagine a review comment here about return type
}

function processData(data) {
    // Line 15: Imagine a review comment here about error handling
    const result = data.map(item => item.value);
    return result;
}

module.exports = { calculateTotal, processData };
