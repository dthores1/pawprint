import React, { useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Forms';
import {
  SearchIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  BuildingIcon } from
'lucide-react';
import { motion } from 'framer-motion';
import { PersonRole } from '../types';
export function Contacts() {
  const { people, fosters } = useWhisker();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PersonRole | 'all'>('all');
  // Merge fosters into volunteers for display
  const mergedPeople = [
  ...people,
  ...fosters.map((f) => ({
    id: f.id,
    first_name: f.first_name,
    last_name: f.last_name,
    email: f.email,
    phone: f.phone,
    role: 'volunteer' as PersonRole,
    volunteer_type: 'foster_parent' as const,
    active: f.active,
    photo_url: f.photo_url,
    created_at: ''
  }))];

  const filteredPeople = mergedPeople.filter((person) => {
    const searchStr =
    `${person.first_name} ${person.last_name} ${person.email} ${person.organization_name || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || person.role === activeTab;
    return matchesSearch && matchesTab;
  });
  const tabs: {
    id: PersonRole | 'all';
    label: string;
  }[] = [
  {
    id: 'all',
    label: 'All Contacts'
  },
  {
    id: 'vet',
    label: 'Veterinarians'
  },
  {
    id: 'rescue_staff',
    label: 'Rescue Staff'
  },
  {
    id: 'volunteer',
    label: 'Volunteers'
  },
  {
    id: 'adopter',
    label: 'Adopters'
  }];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Contacts
        </h1>
        <p className="text-text-secondary">
          Directory of vets, staff, volunteers, and adopters.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide">
          {tabs.map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-card text-text-secondary hover:bg-background hover:text-text-primary border border-border'}`}>
            
              {tab.label}
            </button>
          )}
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <Input
            placeholder="Search contacts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPeople.length === 0 ?
        <div className="col-span-full p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
            No contacts found.
          </div> :

        filteredPeople.map((person, index) =>
        <motion.div
          key={person.id}
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: index * 0.05
          }}>
          
              <Card className="h-full flex flex-col p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar
                src={person.photo_url}
                name={`${person.first_name} ${person.last_name}`}
                colorKey={person.id}
                type="person"
                size="lg" />
              
                  <div>
                    <h3 className="font-heading font-bold text-lg text-text-primary">
                      {person.first_name} {person.last_name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-background border border-border text-text-secondary rounded-md font-medium capitalize">
                        {person.role.replace('_', ' ')}
                      </span>
                      {person.volunteer_type &&
                  <span className="text-xs px-2 py-0.5 bg-accent text-secondary rounded-md font-medium capitalize">
                          {person.volunteer_type.replace('_', ' ')}
                        </span>
                  }
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  {person.organization_name &&
              <div className="flex items-center gap-2 text-sm text-text-primary font-medium">
                      <BuildingIcon className="w-4 h-4 text-text-secondary" />{' '}
                      {person.organization_name}
                    </div>
              }
                  {person.phone &&
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <PhoneIcon className="w-4 h-4" />{' '}
                      <a
                  href={`tel:${person.phone}`}
                  className="hover:text-primary">
                  
                        {person.phone}
                      </a>
                    </div>
              }
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <MailIcon className="w-4 h-4" />{' '}
                    <a
                  href={`mailto:${person.email}`}
                  className="hover:text-primary truncate">
                  
                      {person.email}
                    </a>
                  </div>
                </div>

                {person.notes &&
            <div className="pt-4 border-t border-border mt-auto">
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {person.notes}
                    </p>
                  </div>
            }
              </Card>
            </motion.div>
        )
        }
      </div>
    </div>);

}