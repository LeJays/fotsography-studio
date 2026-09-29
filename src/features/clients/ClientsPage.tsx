import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Edit2, Mail, Phone, Plus, Trash2, Users } from 'lucide-react';
import { formatAmount } from '../../../shared/money.ts';
import { createClientSchema, type CreateClientInput } from '../../../shared/schemas/client.ts';
import type { ClientSummary } from '../../../shared/types.ts';
import {
  Badge,
  Button,
  Card,
  CardGridSkeleton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatCard,
  Textarea,
  useConfirm,
  useToast,
} from '../../components/ui';
import {
  ApiError,
  archiveClientApi,
  createClientApi,
  fetchClients,
  updateClientApi,
} from '../../lib/api';

export const ClientsPage = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientSummary | null>(null);
  /** Filtre d'affichage : tous les clients, ceux qui doivent encore payer, ou les soldés. */
  const [filter, setFilter] = useState<'all' | 'due' | 'settled'>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({ resolver: zodResolver(createClientSchema) });

  const loadClients = useCallback(async (searchQuery: string) => {
    try {
      const { clients: loadedClients } = await fetchClients(searchQuery);
      setClients(loadedClients);
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Chargement des clients impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadClients(search), 250);
    return () => window.clearTimeout(timeout);
  }, [loadClients, search]);

  const openCreateModal = () => {
    setEditingClient(null);
    reset({ name: '', email: '', phone: '', address: '', notes: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (client: ClientSummary) => {
    setEditingClient(client);
    reset({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone,
      address: client.address ?? '',
      notes: client.notes ?? '',
    });
    setIsModalOpen(true);
  };



  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editingClient) {
        await updateClientApi(editingClient.id, values);
        toast.success('Client mis à jour.');
      } else {
        await createClientApi(values);
        toast.success('Client ajouté avec succès.');
      }
      setIsModalOpen(false);
      await loadClients(search);
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Une erreur est survenue.');
    }
  });

  const handleArchive = async (client: ClientSummary) => {
    const ok = await confirm({
      title: 'Archiver le client',
      message: `Archiver le client « ${client.name} » ? Ses projets seront conservés.`,
      confirmText: 'Archiver',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await archiveClientApi(client.id);
      toast.success('Client archivé.');
      await loadClients(search);
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Archivage impossible.');
    }
  };

  const totals = useMemo(
    () => clients.reduce(
      (summary, client) => ({
        totalAmount: summary.totalAmount + client.totalAmount,
        paidAmount: summary.paidAmount + client.paidAmount,
        remainingAmount: summary.remainingAmount + client.remainingAmount,
      }),
      { totalAmount: 0, paidAmount: 0, remainingAmount: 0 },
    ),
    [clients],
  );

  const remainingCount = clients.filter((client) => client.remainingAmount > 0).length;
  const visibleClients = useMemo(
    () =>
      clients.filter((client) =>
        filter === 'due' ? client.remainingAmount > 0 : filter === 'settled' ? client.remainingAmount === 0 : true,
      ),
    [clients, filter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Gérez les contacts, les engagements et les créances."
        actions={<Button onClick={openCreateModal}><Plus className="h-4 w-4" />Nouveau client</Button>}
      />
      <div className="studio-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients actifs" value={clients.length.toString()} hint="Fiches non archivées" />
        <StatCard label="Engagements" value={formatAmount(totals.totalAmount)} hint="Montant facturé" />
        <StatCard label="Encaissé" value={formatAmount(totals.paidAmount)} hint="Paiements reçus" />
        <StatCard label="Reste dû" value={formatAmount(totals.remainingAmount)} hint="Créances en cours" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="client-search" className="sr-only">Rechercher un client</label>
          <SearchInput
            id="client-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom, téléphone, email ou ville…"
          />
        </div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tous', count: clients.length },
            { value: 'due', label: 'Reste dû', count: remainingCount },
            { value: 'settled', label: 'Soldés', count: clients.length - remainingCount },
          ]}
        />
      </div>


      {isLoading ? (
        <CardGridSkeleton />
      ) : visibleClients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={search ? 'Aucun client trouvé' : filter === 'all' ? 'Aucun client enregistré' : 'Aucun client dans ce filtre'}
          description={search ? 'Modifiez votre recherche pour trouver un autre contact.' : filter === 'all' ? 'Ajoutez votre premier client pour commencer.' : 'Changez de filtre pour consulter les autres fiches clients.'}
          action={search || filter !== 'all' ? undefined : <Button onClick={openCreateModal}><Plus className="h-4 w-4" />Nouveau client</Button>}
        />
      ) : (
        <div className="studio-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleClients.map((client) => (
            <Card key={client.id} className="studio-card-hover space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/clients/${client.id}`} className="font-serif text-xl font-bold text-studio-dark hover:underline">{client.name}</Link>
                  {client.address ? <p className="mt-1 text-xs text-studio-dark/50">{client.address}</p> : null}
                </div>
                <Badge tone={client.projectCount ? 'gold' : 'gray'}>{client.projectCount} projet{client.projectCount > 1 ? 's' : ''}</Badge>
              </div>
              <div className="space-y-1.5 text-sm text-studio-dark/65">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-studio-terracotta" />{client.phone}</p>
                {client.email ? <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-studio-terracotta" />{client.email}</p> : null}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-studio-dark/10 pt-3 text-xs">
                <div><p className="text-studio-dark/45">Facturé</p><strong>{formatAmount(client.totalAmount)}</strong></div>
                <div><p className="text-studio-dark/45">Encaissé</p><strong className="text-green-700">{formatAmount(client.paidAmount)}</strong></div>
                <div><p className="text-studio-dark/45">Solde</p><strong className={client.remainingAmount ? 'text-red-600' : 'text-green-700'}>{formatAmount(client.remainingAmount)}</strong></div>
              </div>
              <div className="flex justify-end gap-1 border-t border-studio-dark/10 pt-3">
                <Button variant="ghost" size="sm" title="Modifier" onClick={() => openEditModal(client)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" title="Archiver" onClick={() => void handleArchive(client)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="lg" title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        subtitle={editingClient ? `Mettez à jour les coordonnées de ${editingClient.name}.` : 'Ajoutez un contact client à votre répertoire.'}
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Nom complet *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Ex. Jean Dupont" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone *" error={errors.phone?.message}><Input {...register('phone')} placeholder="+237 6 00 00 00 00" /></Field>
            <Field label="Email" error={errors.email?.message}><Input {...register('email')} type="email" placeholder="client@exemple.com" /></Field>
          </div>
          <Field label="Adresse / Ville" error={errors.address?.message}><Input {...register('address')} placeholder="Douala, Bonapriso" /></Field>
          <Field label="Notes et préférences" error={errors.notes?.message}><Textarea {...register('notes')} placeholder="Style de photo, attentes particulières…" /></Field>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button>
            <Button type="submit" loading={isSubmitting}>{editingClient ? 'Enregistrer' : 'Créer le client'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
