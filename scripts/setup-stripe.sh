#!/bin/bash

# LaunchReady - Stripe Setup Script
# This script creates the pricing products in Stripe Test Mode

set -e

echo "🚀 LaunchReady Stripe Setup"
echo "==========================="
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Install with: brew install stripe/stripe-cli/stripe"
    exit 1
fi

# Check if logged in
if ! stripe config --list &> /dev/null; then
    echo "📝 Please login to Stripe first..."
    stripe login
fi

echo "Creating LaunchReady products and prices..."
echo ""

# Create Pro Product ($19/month)
echo "1️⃣ Creating Pro tier..."
PRO_PRODUCT=$(stripe products create \
    --name="LaunchReady Pro" \
    --description="For serious indie hackers - 6 projects, unlimited scans, auto-scheduling" \
    --metadata[tier]="pro" \
    --format=json | jq -r '.id')

PRO_PRICE=$(stripe prices create \
    --product="$PRO_PRODUCT" \
    --unit-amount=1900 \
    --currency=usd \
    --recurring[interval]=month \
    --format=json | jq -r '.id')

echo "   ✅ Pro Product: $PRO_PRODUCT"
echo "   ✅ Pro Price: $PRO_PRICE"

# Create Pro Plus Product ($39/month)
echo "2️⃣ Creating Pro Plus tier..."
PRO_PLUS_PRODUCT=$(stripe products create \
    --name="LaunchReady Pro Plus" \
    --description="For agencies and teams - 15 projects, team members, white-label" \
    --metadata[tier]="pro_plus" \
    --format=json | jq -r '.id')

PRO_PLUS_PRICE=$(stripe prices create \
    --product="$PRO_PLUS_PRODUCT" \
    --unit-amount=3900 \
    --currency=usd \
    --recurring[interval]=month \
    --format=json | jq -r '.id')

echo "   ✅ Pro Plus Product: $PRO_PLUS_PRODUCT"
echo "   ✅ Pro Plus Price: $PRO_PLUS_PRICE"

# Create Enterprise Product ($99/month)
echo "3️⃣ Creating Enterprise tier..."
ENTERPRISE_PRODUCT=$(stripe products create \
    --name="LaunchReady Enterprise" \
    --description="For large organizations - Unlimited projects, API access, SLA support" \
    --metadata[tier]="enterprise" \
    --format=json | jq -r '.id')

ENTERPRISE_PRICE=$(stripe prices create \
    --product="$ENTERPRISE_PRODUCT" \
    --unit-amount=9900 \
    --currency=usd \
    --recurring[interval]=month \
    --format=json | jq -r '.id')

echo "   ✅ Enterprise Product: $ENTERPRISE_PRODUCT"
echo "   ✅ Enterprise Price: $ENTERPRISE_PRICE"

# Get webhook signing secret
echo ""
echo "4️⃣ Getting API keys..."
API_KEY=$(stripe config --list 2>/dev/null | grep "test_mode_api_key" | awk '{print $2}' || echo "")

if [ -z "$API_KEY" ]; then
    echo "   ⚠️  Could not retrieve API key automatically."
    echo "   Go to: https://dashboard.stripe.com/test/apikeys"
fi

echo ""
echo "============================================="
echo "✅ Stripe Setup Complete!"
echo "============================================="
echo ""
echo "Add these to your Vercel environment variables:"
echo ""
echo "STRIPE_PRO_PRICE_ID=$PRO_PRICE"
echo "STRIPE_PRO_PLUS_PRICE_ID=$PRO_PLUS_PRICE"
echo "STRIPE_ENTERPRISE_PRICE_ID=$ENTERPRISE_PRICE"
echo ""
echo "Also needed (from Stripe Dashboard):"
echo "- STRIPE_SECRET_KEY: https://dashboard.stripe.com/test/apikeys"
echo "- STRIPE_WEBHOOK_SECRET: https://dashboard.stripe.com/test/webhooks"
echo "- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: https://dashboard.stripe.com/test/apikeys"
echo ""
echo "Webhook endpoint URL:"
echo "https://launchready-phi.vercel.app/api/webhooks/stripe"
echo ""
echo "Run this to add them to Vercel:"
echo ""
echo "vercel env add STRIPE_PRO_PRICE_ID"
echo "vercel env add STRIPE_PRO_PLUS_PRICE_ID"
echo "vercel env add STRIPE_ENTERPRISE_PRICE_ID"
echo "vercel env add STRIPE_SECRET_KEY"
echo "vercel env add STRIPE_WEBHOOK_SECRET"
echo "vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
