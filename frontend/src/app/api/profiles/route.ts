import { NextRequest, NextResponse } from 'next/server';

// Mock mode - set to true to test without Supabase
const USE_MOCK_DATA = false;

// Mock profile storage (in-memory, resets on server restart)
const mockProfiles = new Map();

export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/profiles - Creating/updating profile');

    const body = await request.json();
    const {
      walletAddress,
      name,
      bio,
      avatarUrl,
      skills,
      college,
      location,
      websiteUrl,
      githubUrl,
      linkedinUrl,
      twitterUrl,
    } = body;

    // Validate required fields
    if (!walletAddress || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress and name are required' },
        { status: 400 }
      );
    }

    if (USE_MOCK_DATA) {
      // Mock: Save to in-memory storage
      const profile = {
        wallet_address: walletAddress,
        name,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        skills: skills || [],
        college: college || null,
        location: location || null,
        website_url: websiteUrl || null,
        github_url: githubUrl || null,
        linkedin_url: linkedinUrl || null,
        twitter_url: twitterUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockProfiles.set(walletAddress, profile);
      console.log('✅ Mock profile saved for:', walletAddress);

      return NextResponse.json(
        { success: true, profile },
        { status: 201 }
      );
    }

    // Real Supabase implementation
    const { createClient } = require('@supabase/supabase-js');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert profile (insert or update)
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({
        wallet_address: walletAddress,
        name,
        bio,
        avatar_url: avatarUrl,
        skills,
        college,
        location,
        website_url: websiteUrl,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        twitter_url: twitterUrl,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving profile:', error);
      return NextResponse.json(
        { error: 'Failed to save profile: ' + error.message },
        { status: 500 }
      );
    }

    console.log('✅ Profile saved successfully');
    return NextResponse.json(
      { success: true, profile },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ Error in POST /api/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📖 GET /api/profiles');

    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    console.log('Fetching profile for:', wallet);

    if (USE_MOCK_DATA) {
      // Return mock profile
      const profile = mockProfiles.get(wallet);

      if (profile) {
        console.log('✅ Mock profile found');
        return NextResponse.json({ profile });
      } else {
        console.log('⚠️ No mock profile found');
        return NextResponse.json({ profile: null }, { status: 404 });
      }
    }

    // Real Supabase implementation
    const { createClient } = require('@supabase/supabase-js');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile: ' + error.message },
        { status: 500 }
      );
    }

    if (!profile) {
      console.log('⚠️ Profile not found');
      return NextResponse.json({ profile: null }, { status: 404 });
    }

    console.log('✅ Profile found');
    return NextResponse.json({ profile });

  } catch (error: any) {
    console.error('❌ Error in GET /api/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}