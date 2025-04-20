import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, Clipboard } from 'react-native';
import { Phone, Mail, Shield, Camera, MapPin, Copy, ChevronDown, LogOut, Info } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

const { width } = Dimensions.get('window');

interface TeamMember {
  name: string;
  role: string;
  quote: string;
}

const teamMembers: TeamMember[] = [
  {
    name: "Frank Bosire",
    role: "Lead Developer",
    quote: "I lead the development of VaultPay, shaping its overall architecture and guiding the direction of the platform. My focus is on ensuring that VaultPay is a scalable, secure, and high-performance system that meets the needs of modern buyers and sellers. I am dedicated to building a platform that establishes trust and makes digital transactions safer."
  },
  {
    name: "Cynthia Obure",
    role: "Senior Developer",
    quote: "I am responsible for VaultPay's back-end infrastructure and database systems. My work involves designing and optimizing the platform's architecture to ensure fast, efficient, and secure transaction processing. I specialize in creating robust, scalable systems that can handle large volumes of transactions while ensuring data integrity and security."
  },
  {
    name: "Grace Thang'wa",
    role: "Front-End Developer",
    quote: "I lead the creation of VaultPay's user interface, focusing on crafting a seamless and engaging user experience. My goal is to design a visually appealing, intuitive, and easy-to-navigate platform that ensures users can interact with VaultPay effortlessly, whether they're on mobile or desktop."
  },
  {
    name: "Daniel Njogu",
    role: "Back-End Developer",
    quote: "I oversee the technical infrastructure of VaultPay, focusing on optimizing the system's performance and security. I ensure that all data is securely processed and stored, and I design the underlying systems that make the platform fast, reliable, and scalable to handle increasing user demand."
  },
  {
    name: "Peter Gekonge",
    role: "QA Specialist & Developer",
    quote: "I ensure VaultPay operates flawlessly by leading rigorous testing efforts to guarantee a bug-free and seamless user experience. Beyond QA, I also specialize in system improvements, collaborating with the development team to enhance the platform's features, optimize performance, and ensure its security."
  }
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleCopyVaultId = async () => {
    if (user?.vault_id) {
      try {
        if (Platform.OS === 'web') {
          await navigator.clipboard.writeText(user.vault_id);
        } else {
          await Clipboard.setString(user.vault_id);
        }
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
            <TouchableOpacity style={styles.cameraButton}>
              <Camera size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user?.name || 'Guest'}</Text>
          <View style={styles.vaultIdContainer}>
            <Text style={styles.vaultIdLabel}>VID:</Text>
            <Text style={styles.vaultId}>{user?.vault_id || 'No VID assigned'}</Text>
            {user?.vault_id && (
              <TouchableOpacity onPress={handleCopyVaultId}>
                {copyFeedback ? (
                  <Text style={styles.copiedText}>Copied!</Text>
                ) : (
                  <Copy size={16} color="#8895A7" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            <View style={[styles.infoItem, styles.infoItemBorder]}>
              <View style={styles.infoLeft}>
                <Mail size={20} color="#0A1D3F" />
                <View>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoItem, styles.infoItemBorder]}>
              <View style={styles.infoLeft}>
                <Phone size={20} color="#0A1D3F" />
                <View>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoLeft}>
                <MapPin size={20} color="#0A1D3F" />
                <View>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{user?.location || 'Not set'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={[styles.infoItem, styles.infoItemBorder]}
              onPress={() => setShowKYC(!showKYC)}>
              <View style={styles.infoLeft}>
                <Shield size={20} color="#0A1D3F" />
                <View>
                  <Text style={styles.infoLabel}>KYC Status</Text>
                  <Text style={styles.infoValue}>Pending Verification</Text>
                </View>
              </View>
              <ChevronDown 
                size={20} 
                color="#8895A7"
                style={[
                  styles.chevron,
                  showKYC && styles.chevronUp
                ]}
              />
            </TouchableOpacity>
            {showKYC && (
              <View style={styles.expandedContent}>
                <Text style={styles.kycTitle}>KYC Verification Coming Soon!</Text>
                <Text style={styles.kycDescription}>
                  We're working on implementing a comprehensive KYC verification process to enhance security and trust in our platform. This feature will include:
                </Text>
                <View style={styles.kycFeatures}>
                  <Text style={styles.kycFeature}>• ID Verification</Text>
                  <Text style={styles.kycFeature}>• Facial Recognition</Text>
                  <Text style={styles.kycFeature}>• Address Verification</Text>
                </View>
                <Text style={styles.kycNote}>
                 We'll notify you when KYC verification becomes available.
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.infoItem, styles.infoItemBorder]}
              onPress={() => setShowAbout(!showAbout)}>
              <View style={styles.infoLeft}>
                <Info size={20} color="#0A1D3F" />
                <View>
                  <Text style={styles.infoLabel}>About Us</Text>
                  <Text style={styles.infoValue}>Know more about us</Text>
                </View>
              </View>
              <ChevronDown 
                size={20} 
                color="#8895A7"
                style={[
                  styles.chevron,
                  showAbout && styles.chevronUp
                ]}
              />
            </TouchableOpacity>
            {showAbout && (
              <View style={styles.expandedContent}>
                <Text style={styles.aboutText}>
                  VaultPay is a secure platform designed to ensure that buyers and sellers can engage in transactions with complete trust. As social media platforms like TikTok and Instagram fuel the growth of small businesses and online selling, VaultPay provides a reliable and transparent way to complete these transactions. We hold funds securely until both parties fulfill their obligations, offering peace of mind and security for everyone involved.
                </Text>
                
                <TouchableOpacity 
                  style={styles.teamSection}
                  onPress={() => setShowTeam(!showTeam)}>
                  <Text style={styles.teamHeader}>Meet Our Team</Text>
                  <ChevronDown 
                    size={20} 
                    color="#8895A7"
                    style={[
                      styles.chevron,
                      showTeam && styles.chevronUp
                    ]}
                  />
                </TouchableOpacity>

                {showTeam && (
                  <View style={styles.teamMembers}>
                    {teamMembers.map((member, index) => (
                      <View key={member.name} style={styles.teamMember}>
                        <TouchableOpacity
                          style={styles.teamMemberHeader}
                          onPress={() => setExpandedMember(
                            expandedMember === member.name ? null : member.name
                          )}>
                          <View>
                            <Text style={styles.teamMemberName}>{member.name}</Text>
                            <Text style={styles.teamMemberRole}>{member.role}</Text>
                          </View>
                          <ChevronDown 
                            size={16} 
                            color="#8895A7"
                            style={[
                              styles.chevron,
                              expandedMember === member.name && styles.chevronUp
                            ]}
                          />
                        </TouchableOpacity>
                        {expandedMember === member.name && (
                          <Text style={styles.teamMemberQuote}>"{member.quote}"</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={signOut}>
          <LogOut size={20} color="#0A1D3F" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 40 : 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0A1D3F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 36,
    color: '#FFFFFF',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#0A1D3F',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 24,
    color: '#0A1D3F',
    marginBottom: 8,
  },
  vaultIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  vaultIdLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#0A1D3F',
  },
  vaultId: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#8895A7',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#8895A7',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
  },
  infoValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#0A1D3F',
  },
  copiedText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#10B981',
  },
  expandableSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  expandedContent: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  aboutText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
    lineHeight: 20,
    marginBottom: 24,
  },
  teamSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0A1D3F',
  },
  teamMembers: {
    gap: 16,
  },
  teamMember: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  teamMemberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  teamMemberName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0A1D3F',
    marginBottom: 2,
  },
  teamMemberRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8895A7',
  },
  teamMemberQuote: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
    fontStyle: 'italic',
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#F3F4F6',
  },
  kycTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0A1D3F',
    marginBottom: 12,
  },
  kycDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
    lineHeight: 20,
    marginBottom: 16,
  },
  kycFeatures: {
    marginBottom: 16,
  },
  kycFeature: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
    lineHeight: 24,
  },
  kycNote: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6366F1',
    fontStyle: 'italic',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 32,
    marginBottom: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoutText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0A1D3F',
  },
});