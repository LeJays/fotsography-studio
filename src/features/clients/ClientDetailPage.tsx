import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Edit2,
  FolderKanban,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDate } from '../../../shared/dates.ts';
import { formatAmount } from '../../../shared/money.ts';
import { updateClientSchema, type UpdateClientInput } from '../../../shared/schemas/client.ts';
import type { ClientDetail, ClientProjectSummary } from '../../../shared/types.ts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  StatCard,
  StatsSkeleton,
  TableWrapper,
  Td,
  Textarea,
  Th,
  useConfirm,
  useToast,
} from '../../components/ui';
import { ApiError, archiveClientApi, fetchClient, updateClientApi } from '../../lib/api';

const projectStatusLabels: Record<ClientProjectSummary['status'], string> = {
  DRAFT: 'Brouillon',
  IN_PROGRESS: 'En cours',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
};

const projectStatusTone = (
  status: ClientProjectSummary['status'],
): 'gold' | 'green' | 'red' | 'gray' => {
  if (status === 'DELIVERED') return 'green';
  if (status === 'IN_PROGRESS') return 'gold';
  if (status === 'CANCELLED') return 'red';
  return 'gray';
};

export const ClientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateClientInput>({ resolver: zodResolver(updateClientSchema) });

  const loadClient = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { client: loadedClient } = await fetchClient(id);
      setClient(loadedClient);
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Impossible de charger ce client.');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  const openEditModal = () => {
    if (!client) return;
    reset({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone,
      address: client.address ?? '',
      notes: client.notes ?? '',
    });
    setIsEditOpen(true);
  };

  const onSave = handleSubmit(async (values) => {
    if (!client) return;
    setIsSaving(true);
    try {
      await updateClientApi(client.id, values);
      setIsEditOpen(false);
      toast.success('Client mis à jour.');
      await loadClient();
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Erreur lors de la mise à jour.');
    } finally {
      setIsSaving(false);
    }
  });

  const handleArchive = async () => {
    if (!client) return;
    const ok = await confirm({
      title: 'Archiver le client',
      message: `Archiver le client « ${client.name} » ? Ses projets existants seront conservés.`,
      confirmText: 'Archiver',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await archiveClientApi(client.id);
      toast.success('Client archivé.');
      navigate('/clients');
    } catch (requestError) {
      toast.error(requestError instanceof ApiError ? requestError.message : 'Archivage impossible.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-hidden="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <StatsSkeleton />
        <Card className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link to="/clients">
          <Button variant="secondary"><ArrowLeft className="h-4 w-4" />Retour aux clients</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/clients" aria-label="Retour aux clients">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-studio-dark">{client.name}</h1>
            <p className="text-xs text-studio-dark/50">
              Client depuis le {formatDate(client.createdAt)}
              {client.createdByName ? ` · créé par ${client.createdByName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openEditModal}><Edit2 className="h-4 w-4" />Modifier</Button>
          <Button variant="danger" onClick={() => void handleArchive()}><Trash2 className="h-4 w-4" />Archiver</Button>
        </div>
      </div>

      <div className="studio-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projets" value={client.projectCount.toString()} hint="Projets actifs" />
        <StatCard label="Total facturé" value={formatAmount(client.totalAmount)} hint="Montant contractualisé" />
        <StatCard label="Encaissé" value={formatAmount(client.paidAmount)} hint="Paiements reçus" />
        <StatCard label="Reste à percevoir" value={formatAmount(client.remainingAmount)} hint="Solde du compte" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-1">
          <h2 className="font-serif text-lg font-bold text-studio-dark">Coordonnées</h2>
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-studio-terracotta" />{client.phone}</p>
            {client.email ? <a className="flex items-center gap-3 hover:underline" href={`mailto:${client.email}`}><Mail className="h-4 w-4 text-studio-terracotta" />{client.email}</a> : null}
            {client.address ? <p className="flex items-center gap-3"><MapPin className="h-4 w-4 text-studio-terracotta" />{client.address}</p> : null}
          </div>
          {client.notes ? (
            <div className="border-t border-studio-dark/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-studio-dark/50">Notes et préférences</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-studio-dark/75">{client.notes}</p>
            </div>
          ) : null}
        </Card>

        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-bold text-studio-dark">Historique des projets</h2>
            <Button size="sm" disabled title="Disponible en Phase 3"><Plus className="h-4 w-4" />Nouveau projet</Button>
          </div>
          {client.projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="Aucun projet"
              description="Les projets de ce client apparaîtront ici dès que le module Phase 3 sera disponible."
            />
          ) : (
            <TableWrapper>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <Th>�0vénement</Th><Th>Date</Th><Th>Statut</Th><Th>Total</Th>
                    <Th>Avance (30 %)</Th><Th>Intermédiaire (50 %)</Th><Th>Solde (20 %)</Th><Th>Reste dû</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.projects.map((project) => (
                    <tr key={project.id}>
                      <Td>
                        <p className="font-semibold text-studio-dark">{project.eventName}</p>
                        <p className="text-xs text-studio-dark/50">{project.eventLocation}</p>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(project.eventDate)}</span>
                        <span className="mt-1 block text-xs text-studio-dark/50">Livraison : {formatDate(project.globalDeliveryDate)}</span>
                      </Td>
                      <Td><Badge tone={projectStatusTone(project.status)}>{projectStatusLabels[project.status]}</Badge></Td>
                      <Td className="font-semibold">{formatAmount(project.totalAmount)}</Td>
                      <Td>{formatAmount(project.advanceAmount)}</Td>
                      <Td>{formatAmount(project.intermediateAmount)}</Td>
                      <Td>{formatAmount(project.finalAmount)}</Td>
                      <Td>
                        {project.remainingAmount > 0 ? (
                          <span className="font-semibold text-red-600">{formatAmount(project.remainingAmount)}</span>
                        ) : <Badge tone="green">Soldé</Badge>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </section>
      </div>


      <Modal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        size="lg" title="Modifier le client"
        subtitle={`Mettez à jour les coordonnées de ${client.name}.`}
      >
        <form className="space-y-4" onSubmit={onSave}>
          <Field label="Nom complet *" error={errors.name?.message}><Input {...register('name')} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone *" error={errors.phone?.message}><Input {...register('phone')} /></Field>
            <Field label="Email" error={errors.email?.message}><Input {...register('email')} type="email" /></Field>
          </div>
          <Field label="Adresse / Ville" error={errors.address?.message}><Input {...register('address')} /></Field>
          <Field label="Notes et préférences" error={errors.notes?.message}><Textarea {...register('notes')} /></Field>
          <div className="flex justify-end gap-2 border-t border-studio-dark/10 pt-4">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button type="submit" loading={isSaving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

