import React, { useState } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { AddContactModal } from '../components/contacts/AddContactModal';
import { EditContactModal } from '../components/contacts/EditContactModal';
import {
  SearchIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  BuildingIcon,
  Edit2Icon,
  PlusIcon } from
'lucide-react';
import { motion } from 'framer-motion';
import { Person, PersonRole } from '../types';
export function Contacts() {
  const { people, peopleLoading } = useWhisker();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PersonRole | 'all'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  // Fosters are people now (role 'foster_parent'). Account/self records (linked
  // to an app user) are identity rows, not directory contacts — keep them out.
  const directory = people.filter((p) => !p.user_id);

  const filteredPeople = directory.filter((person) => {
    const searchStr =
    `${person.first_name} ${person.last_name} ${person.email} ${person.organization_name || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || person.roles.includes(activeTab);
    return matchesSearch && matchesTab;
  });
  const humanizeRole = (r: PersonRole) => r.replace('_', ' ');
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
    id: 'volunteer',
    label: 'Volunteers'
  },
  {
    id: 'foster_parent',
    label: 'Foster Parents'
  },
  {
    id: 'trapper',
    label: 'Trappers'
  },
  {
    id: 'transport',
    label: 'Transport'
  }];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Contacts
          </h1>
          <p className="text-text-secondary">
            Directory of vets, staff, volunteers, and adopters.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          New Contact
        </Button>
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
        {peopleLoading && people.length === 0 ?
        <div className="col-span-full p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
            Loading contacts…
          </div> :
        filteredPeople.length === 0 ?
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
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <Avatar
                  src={person.photo_url}
                  name={`${person.first_name} ${person.last_name}`}
                  colorKey={person.id}
                  type="person"
                  size="lg" />

                    <div className="min-w-0">
                      <h3 className="font-heading font-bold text-lg text-text-primary">
                        {person.first_name} {person.last_name}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {person.roles.map((r) =>
                    <span
                      key={r}
                      className="text-xs px-2 py-0.5 bg-background border border-border text-text-secondary rounded-md font-medium capitalize">

                            {humanizeRole(r)}
                          </span>
                    )}
                      </div>
                    </div>
                  </div>
                  <button
                  type="button"
                  onClick={() => setEditingPerson(person)}
                  aria-label={`Edit ${person.first_name} ${person.last_name}`}
                  className="shrink-0 p-1.5 -mr-1 -mt-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                    <Edit2Icon className="w-4 h-4" />
                  </button>
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

      <AddContactModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editingPerson &&
      <EditContactModal
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        person={editingPerson} />
      }
    </div>);

}