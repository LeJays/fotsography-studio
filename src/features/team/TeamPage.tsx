import React, { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus, UserCog } from 'lucide-react';
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from '../../../shared/consts.ts';
import { formatDateTime } from '../../../shared/dates.ts';
import { createUserSchema, type CreateUserInput } from '../../../shared/schemas/user.ts';
import type { UserSummary } from '../../../shared/types.ts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  TableWrapper,
  Td,
  Th,
} from '../../components/ui';
import { ApiError, archiveUserApi, createUserApi, fetchUsers, updateUserApi } from '../../lib/api';

/** Gestion de l'équipe : l'administrateur crée les membres et leur attribue un rôle. */
export const TeamPage: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });

  const load = useCallback(async () => {
    setListError('');

    try {
      const { users: loaded } = await fetchUsers();
      setUsers(loaded);
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Chargement impossible.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchUsers()
      .then(({ users: loaded }) => {
        if (!cancelled) setUsers(loaded);
      })
      .catch((error) => {
        if (!cancelled) {
          setListError(error instanceof ApiError ? error.message : 'Chargement impossible.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');

    try {
      await createUserApi(values);
      setIsModalOpen(false);
      reset();
      setFeedback(
        `Membre « ${values.name} » créé. Il définira son mot de passe à la première connexion.`,
      );
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Création impossible.');
    }
  });

  const handleRoleChange = async (user: UserSummary, role: string) => {
    setFeedback('');

    try {
      await updateUserApi(user.id, { role: role as StaffRole });
      await load();
      setFeedback(`Rôle de ${user.name} mis à jour.`);
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Modification impossible.');
    }
  };

  const handleToggleActive = async (user: UserSummary) => {
    setListError('');
    setFeedback('');

    try {
      await updateUserApi(user.id, { isActive: !user.isActive });
      await load();
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Modification impossible.');
    }
  };

  const handleArchive = async (user: UserSummary) => {
    if (!window.confirm(`Archiver le compte de ${user.name} ? Il ne pourra plus se connecter.`)) {
      return;
    }

    setListError('');
    setFeedback('');

    try {
      await archiveUserApi(user.id);
      await load();
      setFeedback(`Compte de ${user.name} archivé.`);
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : 'Archivage impossible.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle="Créez les comptes des membres du studio et attribuez-leur un rôle."
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau membre
          </Button>
        }
      />

      {listError ? (
        <Alert tone="error" className="mb-4">
          {listError}
        </Alert>
      ) : null}

      {feedback ? (
        <Alert tone="success" className="mb-4">
          {feedback}
        </Alert>
      ) : null}

      <Card>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-studio-dark/50">Chargement de l'équipe…</p>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-5 w-5" />}
            title="Aucun membre"
            description="Créez le premier compte de l'équipe pour commencer à distribuer les tâches."
            action={<Button onClick={() => setIsModalOpen(true)}>Créer un membre</Button>}
          />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Membre</Th>
                <Th>Contact</Th>
                <Th>Rôle</Th>
                <Th>État</Th>
                <Th>Dernière connexion</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td>
                    <span className="font-semibold text-studio-dark">{user.name}</span>
                    {user.mustChangePassword ? (
                      <Badge tone="gold" className="ml-2">
                        mot de passe à définir
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="block">{user.email}</span>
                    <span className="text-xs text-studio-dark/50">{user.phone}</span>
                  </Td>
                  <Td>
                    <Select
                      value={user.role}
                      onChange={(event) => void handleRoleChange(user, event.target.value)}
                      className="min-w-40"
                      aria-label={`Rôle de ${user.name}`}
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Badge tone={user.isActive ? 'green' : 'red'}>
                      {user.isActive ? 'Actif' : 'Désactivé'}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-studio-dark/60">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Jamais connecté'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleToggleActive(user)}
                      >
                        {user.isActive ? 'Désactiver' : 'Réactiver'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void handleArchive(user)}>
                        Archiver
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </Card>

      <p className="mt-4 text-xs text-studio-dark/45">
        Les membres créés ici définissent leur mot de passe à la première connexion. Les montants
        demandés aux clients restent invisibles pour eux.
      </p>

      <Modal
        open={isModalOpen}
        title="Nouveau membre"
        subtitle="Le membre se connecte avec cet email et définit son mot de passe à la première connexion."
        onClose={() => {
          setIsModalOpen(false);
          setFormError('');
          reset();
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                reset();
              }}
            >
              Annuler
            </Button>
            <Button form="create-member-form" type="submit" loading={isSubmitting}>
              Créer le membre
            </Button>
          </>
        }
      >
        {formError ? (
          <Alert tone="error" className="mb-4">
            {formError}
          </Alert>
        ) : null}

        <form id="create-member-form" onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom complet" htmlFor="member-name" error={errors.name?.message}>
            <Input id="member-name" placeholder="Ex. Awa Traoré" {...register('name')} />
          </Field>

          <Field label="Adresse email" htmlFor="member-email" error={errors.email?.message}>
            <Input
              id="member-email"
              type="email"
              placeholder="awa@fotsography.cm"
              {...register('email')}
            />
          </Field>

          <Field label="Téléphone" htmlFor="member-phone" error={errors.phone?.message}>
            <Input id="member-phone" placeholder="+237 6XX XX XX XX" {...register('phone')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rôle" htmlFor="member-role" error={errors.role?.message}>
              <Select id="member-role" {...register('role')}>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Mot de passe provisoire"
              htmlFor="member-password"
              hint="6 caractères minimum"
              error={errors.password?.message}
            >
              <Input
                id="member-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register('password')}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
};
